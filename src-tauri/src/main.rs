#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use agentsmith_desktop_core::{
    build_mount_command_with_executable, build_open_command_for_os, expand_mount_target_for_os,
    mark_mount_active, mark_mount_failed, resolve_installer_target_from_inputs,
    resolve_juicefs_executable, DesktopAuthCallbackPayload, DesktopAuthConfig,
    fetch_desktop_auth_config_from_base_url, listen_for_auth_callback,
    run_doctor_checks as core_run_doctor_checks, DoctorCheck, MountLifecycleState, MountRecord,
    MountSpec,
};
use parking_lot::Mutex;
use std::{
    collections::HashMap,
    io::ErrorKind,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    thread,
    time::Duration,
};
use tauri::Manager;

#[derive(Debug)]
struct RunningMount {
    mount_target: String,
    child: Child,
}

#[derive(Default)]
struct MountRegistry {
    entries: Mutex<HashMap<String, RunningMount>>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct MountLibraryRequest {
    #[serde(alias = "libraryId")]
    library_id: String,
    spec: MountSpec,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct DoctorHandoffRequest {
    #[serde(alias = "actionKey")]
    action_key: String,
    #[serde(alias = "installerKey")]
    installer_key: Option<String>,
    url: String,
}

fn prepare_mount_target(spec: &MountSpec) -> Result<(), String> {
    if matches!(spec.platform, agentsmith_desktop_core::MountPlatform::Windows) {
        return Ok(());
    }

    std::fs::create_dir_all(&spec.mount_target)
        .map_err(|error| format!("desktop_mount_target_prepare_failed:{error}"))
}

fn resolve_mount_target(spec: &MountSpec) -> String {
    let home_dir = std::env::var("HOME")
        .ok()
        .or_else(|| std::env::var("USERPROFILE").ok());
    expand_mount_target_for_os(std::env::consts::OS, &spec.mount_target, home_dir.as_deref())
}

fn read_child_stderr(child: &mut Child) -> String {
    let mut stderr_output = String::new();
    if let Some(mut stderr) = child.stderr.take() {
        let _ = std::io::Read::read_to_string(&mut stderr, &mut stderr_output);
    }
    stderr_output.trim().to_string()
}

fn is_mount_ready(spec: &MountSpec) -> Result<bool, String> {
    match spec.platform {
        agentsmith_desktop_core::MountPlatform::Linux => {
            let status = Command::new("mountpoint")
                .args(["-q", &spec.mount_target])
                .status()
                .map_err(|error| format!("desktop_mount_probe_failed:{error}"))?;
            Ok(status.success())
        }
        agentsmith_desktop_core::MountPlatform::Macos => {
            let output = Command::new("mount")
                .output()
                .map_err(|error| format!("desktop_mount_probe_failed:{error}"))?;
            let stdout = String::from_utf8_lossy(&output.stdout);
            Ok(stdout.contains(&format!(" on {} ", spec.mount_target)))
        }
        agentsmith_desktop_core::MountPlatform::Windows => Ok(Path::new(&spec.mount_target).exists()),
    }
}

fn wait_for_mount_ready(child: &mut Child, spec: &MountSpec) -> Result<(), String> {
    const ATTEMPTS: usize = 40;
    const SLEEP_MS: u64 = 100;

    for _ in 0..ATTEMPTS {
        if is_mount_ready(spec)? {
            return Ok(());
        }

        match child.try_wait() {
            Ok(Some(status)) => {
                let stderr = read_child_stderr(child);
                return Err(if stderr.is_empty() {
                    format!("desktop_mount_not_ready:process_exited:{status}")
                } else {
                    format!("desktop_mount_not_ready:{stderr}")
                });
            }
            Ok(None) => {
                thread::sleep(Duration::from_millis(SLEEP_MS));
            }
            Err(error) => {
                return Err(format!("desktop_mount_probe_failed:{error}"));
            }
        }
    }

    let _ = child.kill();
    let _ = child.wait();
    let stderr = read_child_stderr(child);
    Err(if stderr.is_empty() {
        "desktop_mount_not_ready:timeout".into()
    } else {
        format!("desktop_mount_not_ready:{stderr}")
    })
}

fn stop_child_process(child: &mut Child) -> Result<(), String> {
    match child.try_wait() {
        Ok(Some(_)) => Ok(()),
        Ok(None) => {
            child
                .kill()
                .map_err(|error| format!("desktop_mount_stop_failed:{error}"))?;
            child
                .wait()
                .map_err(|error| format!("desktop_mount_wait_failed:{error}"))?;
            Ok(())
        }
        Err(error) => Err(format!("desktop_mount_probe_failed:{error}")),
    }
}

fn open_with_system(target: &str) -> Result<(), String> {
    let command_spec = build_open_command_for_os(std::env::consts::OS, target);
    let mut command = Command::new(&command_spec.executable);
    command.args(&command_spec.args);
    command.stdin(Stdio::null());
    command.stdout(Stdio::null());
    command.stderr(Stdio::null());
    command
        .spawn()
        .map_err(|error| format!("desktop_open_failed:{error}"))?;
    Ok(())
}

#[tauri::command]
fn mount_library(
    state: tauri::State<'_, MountRegistry>,
    request: MountLibraryRequest,
) -> Result<MountRecord, String> {
    let resolved_mount_target = resolve_mount_target(&request.spec);
    let resolved_spec = MountSpec {
        mount_target: resolved_mount_target.clone(),
        ..request.spec.clone()
    };

    {
        let mut entries = state.entries.lock();
        if let Some(existing) = entries.get_mut(&request.library_id) {
            match existing.child.try_wait() {
                Ok(Some(_)) => {}
                Ok(None) => {
                    return Ok(MountRecord {
                        library_id: request.library_id,
                        state: MountLifecycleState::Active,
                        mount_target: Some(existing.mount_target.clone()),
                        last_error: None,
                    });
                }
                Err(error) => {
                    return Err(format!("desktop_mount_probe_failed:{error}"));
                }
            }
        }
        entries.remove(&request.library_id);
    }

    prepare_mount_target(&resolved_spec)?;

    let executable = resolve_juicefs_executable(&resolved_spec.platform)?;
    let command_spec = build_mount_command_with_executable(executable, &resolved_spec);
    let mut command = Command::new(&command_spec.executable);
    command.args(&command_spec.args);
    command.envs(command_spec.env.clone());
    command.stdin(Stdio::null());
    command.stdout(Stdio::null());
    command.stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|error| match error.kind() {
            ErrorKind::NotFound => format!("desktop_mount_binary_missing:{}", command_spec.executable),
            _ => format!("desktop_mount_spawn_failed:{error}"),
        })?;

    wait_for_mount_ready(&mut child, &resolved_spec)?;

    let record = mark_mount_active(
        &MountRecord {
            library_id: request.library_id.clone(),
            state: MountLifecycleState::Activating,
            mount_target: None,
            last_error: None,
        },
        resolved_mount_target.clone(),
    );

    state.entries.lock().insert(
        request.library_id,
        RunningMount {
            mount_target: resolved_mount_target,
            child,
        },
    );

    Ok(record)
}

#[tauri::command]
fn unmount_library(
    state: tauri::State<'_, MountRegistry>,
    #[allow(non_snake_case)] libraryId: String,
) -> Result<MountRecord, String> {
    let mut entries = state.entries.lock();
    let mut running = entries
        .remove(&libraryId)
        .ok_or_else(|| "desktop_mount_not_found".to_string())?;
    stop_child_process(&mut running.child)?;
    Ok(MountRecord {
        library_id: libraryId,
        state: MountLifecycleState::Idle,
        mount_target: Some(running.mount_target),
        last_error: None,
    })
}

#[tauri::command]
fn stop_all_mounts(state: tauri::State<'_, MountRegistry>) -> Result<Vec<MountRecord>, String> {
    let mut entries = state.entries.lock();
    let library_ids: Vec<String> = entries.keys().cloned().collect();
    let mut stopped = Vec::new();
    for library_id in library_ids {
        if let Some(mut running) = entries.remove(&library_id) {
            let result = match stop_child_process(&mut running.child) {
                Ok(_) => {
                    MountRecord {
                        library_id,
                        state: MountLifecycleState::Idle,
                        mount_target: Some(running.mount_target),
                        last_error: None,
                    }
                }
                Err(error) => mark_mount_failed(
                    &MountRecord {
                        library_id,
                        state: MountLifecycleState::Deactivating,
                        mount_target: Some(running.mount_target),
                        last_error: None,
                    },
                    format!("desktop_stop_all_failed:{error}"),
                ),
            };
            stopped.push(result);
        }
    }
    Ok(stopped)
}

#[tauri::command]
fn run_doctor_checks() -> Result<Vec<DoctorCheck>, String> {
    Ok(core_run_doctor_checks())
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    open_with_system(&url)
}

#[tauri::command]
fn open_path(path: String) -> Result<(), String> {
    open_with_system(&path)
}

#[tauri::command]
async fn await_auth_callback(port: u16, path: String) -> Result<DesktopAuthCallbackPayload, String> {
    tauri::async_runtime::spawn_blocking(move || listen_for_auth_callback(port, &path))
        .await
        .map_err(|error| format!("desktop_auth_callback_join_failed:{error}"))?
}

#[tauri::command]
fn fetch_desktop_auth_config(
    #[allow(non_snake_case)] deploymentBaseUrl: String,
) -> Result<DesktopAuthConfig, String> {
    fetch_desktop_auth_config_from_base_url(&deploymentBaseUrl)
}

#[tauri::command]
fn handoff_doctor_action(
    app: tauri::AppHandle,
    request: DoctorHandoffRequest,
) -> Result<(), String> {
    if let Some(installer_key) = request.installer_key.as_deref() {
        let resource_dir: Option<PathBuf> = app.path().resource_dir().ok();
        let env_key = format!("AGENTSMITH_DESKTOP_INSTALLER_{}", installer_key.to_ascii_uppercase());
        let override_value = std::env::var(&env_key).ok();
        if let Some(target) = resolve_installer_target_from_inputs(
            installer_key,
            resource_dir.as_deref(),
            override_value.as_deref(),
        ) {
            return open_with_system(&target);
        }
    }

    if request.action_key.is_empty() {
        return Err("desktop_doctor_action_missing".into());
    }

    open_with_system(&request.url)
}

fn main() {
    tauri::Builder::default()
        .manage(MountRegistry::default())
        .invoke_handler(tauri::generate_handler![
            mount_library,
            unmount_library,
            stop_all_mounts,
            run_doctor_checks,
            open_external_url,
            open_path,
            await_auth_callback,
            fetch_desktop_auth_config,
            handoff_doctor_action
        ])
        .run(tauri::generate_context!())
        .expect("failed to run AgentSmith Desktop");
}
