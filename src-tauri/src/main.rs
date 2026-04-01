#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use agentsmith_desktop_core::{
    build_mount_command, mark_mount_active, mark_mount_failed, run_doctor_checks as core_run_doctor_checks,
    DoctorCheck, MountLifecycleState, MountRecord, MountSpec,
};
use parking_lot::Mutex;
use std::{
    collections::HashMap,
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

#[tauri::command]
fn mount_library(
    state: tauri::State<'_, MountRegistry>,
    request: MountLibraryRequest,
) -> Result<MountRecord, String> {
    let command_spec = build_mount_command(&request.spec);
    let mut command = Command::new(&command_spec.executable);
    command.args(&command_spec.args);
    command.envs(command_spec.env.clone());
    command.stdin(Stdio::null());
    command.stdout(Stdio::null());
    command.stderr(Stdio::piped());

    let child = command
        .spawn()
        .map_err(|error| format!("desktop_mount_spawn_failed:{error}"))?;

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
    running
        .child
        .kill()
        .map_err(|error| format!("desktop_unmount_kill_failed:{error}"))?;
    let _ = running.child.wait();
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
            let result = match running.child.kill() {
                Ok(_) => {
                    let _ = running.child.wait();
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

fn main() {
    tauri::Builder::default()
        .manage(MountRegistry::default())
        .invoke_handler(tauri::generate_handler![
            mount_library,
            unmount_library,
            stop_all_mounts,
            run_doctor_checks
        ])
        .run(tauri::generate_context!())
        .expect("failed to run AgentSmith Desktop");
}
