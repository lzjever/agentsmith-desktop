#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use agentsmith_desktop_core::{
    build_mount_command_with_executable, build_open_command_for_os, mark_mount_active, mark_mount_failed,
    resolve_juicefs_executable, run_doctor_checks as core_run_doctor_checks, DoctorCheck,
    MountLifecycleState, MountRecord, MountSpec,
};
use parking_lot::Mutex;
use std::{
    collections::HashMap,
    io::ErrorKind,
    process::{Child, Command, Stdio},
};

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

    let executable = resolve_juicefs_executable(&request.spec.platform)?;
    let command_spec = build_mount_command_with_executable(executable, &request.spec);
    let mut command = Command::new(&command_spec.executable);
    command.args(&command_spec.args);
    command.envs(command_spec.env.clone());
    command.stdin(Stdio::null());
    command.stdout(Stdio::null());
    command.stderr(Stdio::piped());

    let child = command
        .spawn()
        .map_err(|error| match error.kind() {
            ErrorKind::NotFound => format!("desktop_mount_binary_missing:{}", command_spec.executable),
            _ => format!("desktop_mount_spawn_failed:{error}"),
        })?;

    let record = mark_mount_active(
        &MountRecord {
            library_id: request.library_id.clone(),
            state: MountLifecycleState::Activating,
            mount_target: None,
            last_error: None,
        },
        request.spec.mount_target.clone(),
    );

    state.entries.lock().insert(
        request.library_id,
        RunningMount {
            mount_target: request.spec.mount_target,
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

fn main() {
    tauri::Builder::default()
        .manage(MountRegistry::default())
        .invoke_handler(tauri::generate_handler![
            mount_library,
            unmount_library,
            stop_all_mounts,
            run_doctor_checks,
            open_external_url,
            open_path
        ])
        .run(tauri::generate_context!())
        .expect("failed to run AgentSmith Desktop");
}
