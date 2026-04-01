use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, env, path::Path};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum MountLifecycleState {
    Idle,
    Activating,
    Active,
    Deactivating,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MountRecord {
    pub library_id: String,
    pub state: MountLifecycleState,
    pub mount_target: Option<String>,
    pub last_error: Option<String>,
}

pub fn restore_mounts(active_library_ids: &[String]) -> Vec<MountRecord> {
    active_library_ids
        .iter()
        .map(|library_id| MountRecord {
            library_id: library_id.clone(),
            state: MountLifecycleState::Activating,
            mount_target: None,
            last_error: None,
        })
        .collect()
}

pub fn stop_all_mounts(records: &[MountRecord]) -> Vec<MountRecord> {
    records
        .iter()
        .map(|record| MountRecord {
            library_id: record.library_id.clone(),
            state: MountLifecycleState::Deactivating,
            mount_target: record.mount_target.clone(),
            last_error: record.last_error.clone(),
        })
        .collect()
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum MountPlatform {
    Linux,
    Macos,
    Windows,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MountSpec {
    pub platform: MountPlatform,
    pub filesystem_name: String,
    pub metadata_url: String,
    pub mount_target: String,
    pub storage_bucket_url: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct JuicefsCommandSpec {
    pub executable: String,
    pub args: Vec<String>,
    pub env: BTreeMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum DoctorCheckStatus {
    #[serde(rename = "ready")]
    Ready,
    #[serde(rename = "missing")]
    Missing,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DoctorCheck {
    pub key: String,
    pub status: DoctorCheckStatus,
    pub detail: String,
}

pub fn build_mount_command(spec: &MountSpec) -> JuicefsCommandSpec {
    let executable = match spec.platform {
        MountPlatform::Windows => "juicefs.exe".to_string(),
        MountPlatform::Linux | MountPlatform::Macos => "juicefs".to_string(),
    };
    let mut args = vec![
        "mount".to_string(),
        spec.metadata_url.clone(),
        spec.mount_target.clone(),
        "--name".to_string(),
        spec.filesystem_name.clone(),
    ];
    if matches!(spec.platform, MountPlatform::Windows) {
        args.push("--as-drive".to_string());
    }
    let mut env = BTreeMap::new();
    if let Some(storage_bucket_url) = &spec.storage_bucket_url {
        env.insert("JFS_STORAGE".to_string(), storage_bucket_url.clone());
    }
    JuicefsCommandSpec {
        executable,
        args,
        env,
    }
}

pub fn mark_mount_active(record: &MountRecord, mount_target: String) -> MountRecord {
    MountRecord {
        library_id: record.library_id.clone(),
        state: MountLifecycleState::Active,
        mount_target: Some(mount_target),
        last_error: None,
    }
}

pub fn mark_mount_failed(record: &MountRecord, error: String) -> MountRecord {
    MountRecord {
        library_id: record.library_id.clone(),
        state: MountLifecycleState::Failed,
        mount_target: record.mount_target.clone(),
        last_error: Some(error),
    }
}

pub fn search_path_for_binary(path_env: &str, binary_names: &[&str]) -> Option<String> {
    env::split_paths(path_env)
        .flat_map(|dir| binary_names.iter().map(move |binary| dir.join(binary)))
        .find(|candidate| candidate.exists())
        .map(|candidate| candidate.display().to_string())
}

pub fn run_doctor_checks() -> Vec<DoctorCheck> {
    let mut checks = Vec::new();
    let juicefs_binary = env::var("PATH")
        .ok()
        .and_then(|path| {
            search_path_for_binary(
                &path,
                if cfg!(target_os = "windows") {
                    &["juicefs.exe"]
                } else {
                    &["juicefs"]
                },
            )
        });
    checks.push(DoctorCheck {
        key: "juicefs".into(),
        status: if juicefs_binary.is_some() {
            DoctorCheckStatus::Ready
        } else {
            DoctorCheckStatus::Missing
        },
        detail: juicefs_binary.unwrap_or_else(|| "juicefs_binary_not_found".into()),
    });

    #[cfg(target_os = "linux")]
    {
        let fuse_device = Path::new("/dev/fuse");
        let fuse_helper = env::var("PATH")
            .ok()
            .and_then(|path| search_path_for_binary(&path, &["fusermount3", "fusermount"]));
        checks.push(DoctorCheck {
            key: "fuse".into(),
            status: if fuse_device.exists() && fuse_helper.is_some() {
                DoctorCheckStatus::Ready
            } else {
                DoctorCheckStatus::Missing
            },
            detail: if !fuse_device.exists() {
                "/dev/fuse_missing".into()
            } else {
                fuse_helper.unwrap_or_else(|| "fusermount_missing".into())
            },
        });
    }

    #[cfg(target_os = "macos")]
    {
        let macfuse_root = Path::new("/Library/Filesystems/macfuse.fs");
        checks.push(DoctorCheck {
            key: "macfuse".into(),
            status: if macfuse_root.exists() {
                DoctorCheckStatus::Ready
            } else {
                DoctorCheckStatus::Missing
            },
            detail: macfuse_root.display().to_string(),
        });
    }

    #[cfg(target_os = "windows")]
    {
        let candidates = [
            r"C:\Program Files\WinFsp\bin\winfsp-x64.dll",
            r"C:\Program Files (x86)\WinFsp\bin\winfsp-x64.dll",
        ];
        let winfsp = candidates.iter().find(|candidate| Path::new(candidate).exists());
        checks.push(DoctorCheck {
            key: "winfsp".into(),
            status: if winfsp.is_some() {
                DoctorCheckStatus::Ready
            } else {
                DoctorCheckStatus::Missing
            },
            detail: winfsp
                .map(|candidate| (*candidate).to_string())
                .unwrap_or_else(|| "winfsp_not_found".into()),
        });
    }

    checks
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use super::{
        build_mount_command, mark_mount_active, mark_mount_failed, restore_mounts, run_doctor_checks,
        search_path_for_binary, stop_all_mounts, DoctorCheckStatus, JuicefsCommandSpec,
        MountLifecycleState, MountPlatform, MountRecord, MountSpec,
    };

    #[test]
    fn restore_marks_active_libraries_as_activating() {
        let restored = restore_mounts(&["lib_1".into(), "lib_2".into()]);
        assert_eq!(restored.len(), 2);
        assert_eq!(restored[0].state, MountLifecycleState::Activating);
        assert_eq!(restored[1].library_id, "lib_2");
        assert_eq!(restored[0].mount_target, None);
    }

    #[test]
    fn stop_all_marks_every_mount_as_deactivating() {
        let records = vec![
            MountRecord {
                library_id: "lib_1".into(),
                state: MountLifecycleState::Active,
                mount_target: Some("/tmp/lib_1".into()),
                last_error: None,
            },
            MountRecord {
                library_id: "lib_2".into(),
                state: MountLifecycleState::Failed,
                mount_target: Some("/tmp/lib_2".into()),
                last_error: Some("mount_failed".into()),
            },
        ];
        let stopped = stop_all_mounts(&records);
        assert!(stopped.iter().all(|record| record.state == MountLifecycleState::Deactivating));
        assert_eq!(stopped[1].last_error.as_deref(), Some("mount_failed"));
    }

    #[test]
    fn builds_linux_mount_command() {
        let command = build_mount_command(&MountSpec {
            platform: MountPlatform::Linux,
            filesystem_name: "fs_demo".into(),
            metadata_url: "postgres://demo".into(),
            mount_target: "/home/user/AgentSmith/ws/lib".into(),
            storage_bucket_url: Some("http://minio.example/bucket".into()),
        });
        assert_eq!(
            command,
            JuicefsCommandSpec {
                executable: "juicefs".into(),
                args: vec![
                    "mount".into(),
                    "postgres://demo".into(),
                    "/home/user/AgentSmith/ws/lib".into(),
                    "--name".into(),
                    "fs_demo".into()
                ],
                env: BTreeMap::from([(
                    "JFS_STORAGE".into(),
                    "http://minio.example/bucket".into()
                )]),
            }
        );
    }

    #[test]
    fn builds_windows_drive_mount_command() {
        let command = build_mount_command(&MountSpec {
            platform: MountPlatform::Windows,
            filesystem_name: "fs_demo".into(),
            metadata_url: "postgres://demo".into(),
            mount_target: "X:".into(),
            storage_bucket_url: None,
        });
        assert_eq!(command.executable, "juicefs.exe");
        assert!(command.args.contains(&"--as-drive".into()));
    }

    #[test]
    fn marks_mount_active_and_failed() {
        let record = MountRecord {
            library_id: "lib_1".into(),
            state: MountLifecycleState::Activating,
            mount_target: None,
            last_error: None,
        };
        let active = mark_mount_active(&record, "/tmp/lib_1".into());
        assert_eq!(active.state, MountLifecycleState::Active);
        assert_eq!(active.mount_target.as_deref(), Some("/tmp/lib_1"));

        let failed = mark_mount_failed(&active, "spawn_failed".into());
        assert_eq!(failed.state, MountLifecycleState::Failed);
        assert_eq!(failed.last_error.as_deref(), Some("spawn_failed"));
    }

    #[test]
    fn searches_path_for_binary() {
        let path = "/tmp:/usr/bin:/bin";
        let found = search_path_for_binary(path, &["sh"]);
        assert!(found.is_some());
    }

    #[test]
    fn doctor_checks_include_juicefs_result() {
        let checks = run_doctor_checks();
        let juicefs = checks.iter().find(|check| check.key == "juicefs");
        assert!(juicefs.is_some());
        assert!(matches!(
            juicefs.unwrap().status,
            DoctorCheckStatus::Ready | DoctorCheckStatus::Missing
        ));
    }
}
