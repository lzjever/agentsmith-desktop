use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    env,
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    path::{Path, PathBuf},
    time::Duration,
};
use url::Url;

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
pub struct OpenCommandSpec {
    pub executable: String,
    pub args: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DesktopAuthCallbackPayload {
    pub code: Option<String>,
    pub state: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DesktopAuthConfig {
    pub deployment_base_url: String,
    pub api_base_url: Option<String>,
    pub issuer: Option<String>,
    pub authorization_endpoint: Option<String>,
    pub token_endpoint: Option<String>,
    pub client_id: Option<String>,
    pub scopes: Option<Vec<String>>,
    pub response_type: Option<String>,
    pub pkce_method: Option<String>,
    pub suggested_callback_origin: Option<String>,
    pub suggested_callback_path: Option<String>,
}

pub fn resolve_installer_target_from_inputs(
    installer_key: &str,
    resource_dir: Option<&Path>,
    override_value: Option<&str>,
) -> Option<String> {
    if let Some(value) = override_value.map(str::trim).filter(|value| !value.is_empty()) {
        return Some(value.to_string());
    }

    let resource_dir = resource_dir?;
    let installer_dir = resource_dir.join("installers");
    let candidates: &[&str] = match installer_key {
        "winfsp" => &["windows/WinFsp.msi", "windows/WinFsp.exe"],
        "macfuse" => &["macos/macFUSE.dmg", "macos/macFUSE.pkg"],
        _ => &[],
    };

    candidates
        .iter()
        .map(|relative| join_relative_path(&installer_dir, relative))
        .find(|candidate| candidate.exists())
        .map(|candidate| candidate.display().to_string())
}

fn join_relative_path(base: &Path, relative: &str) -> PathBuf {
    relative
        .split('/')
        .filter(|segment| !segment.is_empty())
        .fold(base.to_path_buf(), |path, segment| path.join(segment))
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

pub fn default_juicefs_binary_name(platform: &MountPlatform) -> &'static str {
    match platform {
        MountPlatform::Windows => "juicefs.exe",
        MountPlatform::Linux | MountPlatform::Macos => "juicefs",
    }
}

pub fn resolve_juicefs_executable_from_inputs(
    platform: &MountPlatform,
    override_value: Option<&str>,
    path_env: Option<&str>,
) -> Result<String, String> {
    if let Some(value) = override_value.map(str::trim).filter(|value| !value.is_empty()) {
        return Ok(value.to_string());
    }

    let binary_name = default_juicefs_binary_name(platform);
    if let Some(path) = path_env.and_then(|path| search_path_for_binary(path, &[binary_name])) {
        return Ok(path);
    }

    Err(format!("desktop_mount_binary_missing:{binary_name}"))
}

pub fn resolve_juicefs_executable(platform: &MountPlatform) -> Result<String, String> {
    let override_value = env::var("AGENTSMITH_DESKTOP_JUICEFS_BIN")
        .ok()
        .or_else(|| env::var("JFS_DESKTOP_JUICEFS_BIN").ok());
    let path_env = env::var("PATH").ok();
    resolve_juicefs_executable_from_inputs(platform, override_value.as_deref(), path_env.as_deref())
}

pub fn build_mount_command_with_executable(
    executable: String,
    spec: &MountSpec,
) -> JuicefsCommandSpec {
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

pub fn build_mount_command(spec: &MountSpec) -> JuicefsCommandSpec {
    build_mount_command_with_executable(
        default_juicefs_binary_name(&spec.platform).to_string(),
        spec,
    )
}

pub fn build_open_command_for_os(target_os: &str, target: &str) -> OpenCommandSpec {
    match target_os {
        "windows" => OpenCommandSpec {
            executable: "cmd".into(),
            args: vec!["/C".into(), "start".into(), "".into(), target.into()],
        },
        "macos" => OpenCommandSpec {
            executable: "open".into(),
            args: vec![target.into()],
        },
        _ => OpenCommandSpec {
            executable: "xdg-open".into(),
            args: vec![target.into()],
        },
    }
}

pub fn parse_auth_callback_target(
    request_target: &str,
    expected_path: &str,
) -> Result<DesktopAuthCallbackPayload, String> {
    let parsed = Url::parse(&format!("http://127.0.0.1{request_target}"))
        .map_err(|error| format!("desktop_auth_callback_parse_failed:{error}"))?;
    if parsed.path() != expected_path {
        return Err("desktop_auth_callback_path_mismatch".into());
    }
    Ok(DesktopAuthCallbackPayload {
        code: parsed
            .query_pairs()
            .find(|(key, _)| key == "code")
            .map(|(_, value)| value.to_string()),
        state: parsed
            .query_pairs()
            .find(|(key, _)| key == "state")
            .map(|(_, value)| value.to_string()),
        error: parsed
            .query_pairs()
            .find(|(key, _)| key == "error")
            .map(|(_, value)| value.to_string()),
    })
}

fn write_auth_callback_response(stream: &mut TcpStream) -> Result<(), String> {
    stream
        .write_all(
            b"HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n<html><body><h1>AgentSmith Desktop</h1><p>Sign-in complete. You can return to the desktop app.</p></body></html>",
        )
        .map_err(|error| format!("desktop_auth_callback_response_failed:{error}"))
}

pub fn listen_for_auth_callback(
    port: u16,
    expected_path: &str,
) -> Result<DesktopAuthCallbackPayload, String> {
    let listener = TcpListener::bind(("127.0.0.1", port))
        .map_err(|error| format!("desktop_auth_callback_bind_failed:{error}"))?;
    listener
        .set_nonblocking(false)
        .map_err(|error| format!("desktop_auth_callback_bind_failed:{error}"))?;
    let (mut stream, _) = listener
        .accept()
        .map_err(|error| format!("desktop_auth_callback_accept_failed:{error}"))?;
    stream
        .set_read_timeout(Some(Duration::from_secs(120)))
        .map_err(|error| format!("desktop_auth_callback_timeout_failed:{error}"))?;

    let mut buffer = [0_u8; 8192];
    let read = stream
        .read(&mut buffer)
        .map_err(|error| format!("desktop_auth_callback_read_failed:{error}"))?;
    let request = String::from_utf8_lossy(&buffer[..read]);
    let first_line = request
        .lines()
        .next()
        .ok_or_else(|| "desktop_auth_callback_empty_request".to_string())?;
    let mut parts = first_line.split_whitespace();
    let method = parts.next().unwrap_or_default();
    let request_target = parts.next().unwrap_or_default();
    if method != "GET" {
        return Err("desktop_auth_callback_method_invalid".into());
    }
    let payload = parse_auth_callback_target(request_target, expected_path)?;
    write_auth_callback_response(&mut stream)?;
    Ok(payload)
}

pub fn fetch_desktop_auth_config_from_base_url(
    deployment_base_url: &str,
) -> Result<DesktopAuthConfig, String> {
    let normalized = deployment_base_url.trim_end_matches('/');
    let url = format!("{normalized}/api/public/desktop/auth");
    let response = reqwest::blocking::get(&url)
        .map_err(|error| format!("desktop_auth_config_fetch_failed:{error}"))?;
    if !response.status().is_success() {
        return Err(format!("desktop_auth_config_failed_{}", response.status().as_u16()));
    }
    response
        .json::<DesktopAuthConfig>()
        .map_err(|error| format!("desktop_auth_config_parse_failed:{error}"))
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
    use std::{
        collections::BTreeMap,
        env,
        fs,
        io::{Read, Write},
        net::{TcpListener, TcpStream},
        path::PathBuf,
    };

    use super::{
        build_mount_command, build_mount_command_with_executable, build_open_command_for_os,
        fetch_desktop_auth_config_from_base_url, listen_for_auth_callback, mark_mount_active,
        mark_mount_failed, parse_auth_callback_target, resolve_installer_target_from_inputs,
        resolve_juicefs_executable_from_inputs, restore_mounts, run_doctor_checks,
        search_path_for_binary, stop_all_mounts, DesktopAuthCallbackPayload, DoctorCheckStatus,
        JuicefsCommandSpec, MountLifecycleState, MountPlatform, MountRecord, MountSpec,
        OpenCommandSpec,
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
    fn builds_mount_command_with_explicit_executable() {
        let command = build_mount_command_with_executable(
            "/opt/agentsmith/bin/juicefs".into(),
            &MountSpec {
                platform: MountPlatform::Linux,
                filesystem_name: "fs_demo".into(),
                metadata_url: "postgres://demo".into(),
                mount_target: "/tmp/demo".into(),
                storage_bucket_url: None,
            },
        );
        assert_eq!(command.executable, "/opt/agentsmith/bin/juicefs");
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
        let temp_dir = env::temp_dir().join(format!(
            "agentsmith-desktop-search-test-{}",
            std::process::id()
        ));
        fs::create_dir_all(&temp_dir).expect("expected temp dir");
        let binary_name = if cfg!(target_os = "windows") {
            "juicefs.exe"
        } else {
            "juicefs"
        };
        let fake_binary = temp_dir.join(binary_name);
        fs::write(&fake_binary, b"#!/bin/sh\n").expect("expected fake binary");
        let path = env::join_paths([temp_dir.as_path()]).expect("expected PATH string");
        let found = search_path_for_binary(path.to_string_lossy().as_ref(), &[binary_name]);
        assert!(found.is_some());
        let _ = fs::remove_file(&fake_binary);
        let _ = fs::remove_dir(&temp_dir);
    }

    #[test]
    fn resolve_juicefs_executable_prefers_override() {
        let resolved = resolve_juicefs_executable_from_inputs(
            &MountPlatform::Linux,
            Some("/custom/juicefs"),
            Some("/usr/bin:/bin"),
        )
        .expect("expected override to be used");
        assert_eq!(resolved, "/custom/juicefs");
    }

    #[test]
    fn resolve_juicefs_executable_uses_path_lookup() {
        let temp_dir = env::temp_dir().join(format!("agentsmith-desktop-test-{}", std::process::id()));
        fs::create_dir_all(&temp_dir).expect("expected temp dir");
        let binary_name = if cfg!(target_os = "windows") {
            "juicefs.exe"
        } else {
            "juicefs"
        };
        let fake_binary = temp_dir.join(binary_name);
        fs::write(&fake_binary, b"#!/bin/sh\n").expect("expected fake binary");
        let path = env::join_paths([temp_dir.as_path()]).expect("expected PATH string");
        let resolved = resolve_juicefs_executable_from_inputs(
            if cfg!(target_os = "windows") {
                &MountPlatform::Windows
            } else {
                &MountPlatform::Linux
            },
            None,
            Some(path.to_string_lossy().as_ref()),
        )
        .expect("expected PATH lookup to succeed");
        assert_eq!(resolved, fake_binary.display().to_string());
        let _ = fs::remove_file(&fake_binary);
        let _ = fs::remove_dir(&temp_dir);
    }

    #[test]
    fn resolve_juicefs_executable_returns_missing_error_when_unavailable() {
        let error = resolve_juicefs_executable_from_inputs(
            &MountPlatform::Linux,
            None,
            Some("/definitely-not-a-real-bin-dir"),
        )
        .expect_err("expected missing binary error");
        assert_eq!(error, "desktop_mount_binary_missing:juicefs");
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

    #[test]
    fn builds_windows_open_command() {
        assert_eq!(
            build_open_command_for_os("windows", "https://example.com/setup"),
            OpenCommandSpec {
                executable: "cmd".into(),
                args: vec![
                    "/C".into(),
                    "start".into(),
                    "".into(),
                    "https://example.com/setup".into(),
                ],
            }
        );
    }

    #[test]
    fn builds_unix_open_command() {
        assert_eq!(
            build_open_command_for_os("linux", "/tmp/agentsmith-mount"),
            OpenCommandSpec {
                executable: "xdg-open".into(),
                args: vec!["/tmp/agentsmith-mount".into()],
            }
        );
    }

    #[test]
    fn resolve_installer_target_prefers_override() {
        let target = resolve_installer_target_from_inputs(
            "winfsp",
            None,
            Some("C:\\Installers\\WinFsp.msi"),
        );
        assert_eq!(target.as_deref(), Some("C:\\Installers\\WinFsp.msi"));
    }

    #[test]
    fn resolve_installer_target_uses_resource_dir() {
        let resource_dir = env::temp_dir().join(format!("agentsmith-desktop-resource-{}", std::process::id()));
        let installer_path = resource_dir.join("installers/windows");
        fs::create_dir_all(&installer_path).expect("expected installer dir");
        let installer_file = installer_path.join("WinFsp.msi");
        fs::write(&installer_file, b"placeholder").expect("expected installer file");

        let target = resolve_installer_target_from_inputs("winfsp", Some(&resource_dir), None);
        let resolved = target.map(PathBuf::from);
        assert_eq!(resolved.as_deref(), Some(installer_file.as_path()));

        let _ = fs::remove_file(&installer_file);
        let _ = fs::remove_dir_all(&resource_dir);
    }

    #[test]
    fn parses_auth_callback_target() {
        let payload = parse_auth_callback_target(
            "/desktop/auth/callback?code=abc123&state=state_123",
            "/desktop/auth/callback",
        )
        .expect("expected callback target");
        assert_eq!(
            payload,
            DesktopAuthCallbackPayload {
                code: Some("abc123".into()),
                state: Some("state_123".into()),
                error: None,
            }
        );
    }

    #[test]
    fn rejects_auth_callback_path_mismatch() {
        let error = parse_auth_callback_target(
            "/wrong/path?code=abc123&state=state_123",
            "/desktop/auth/callback",
        )
        .expect_err("expected mismatch");
        assert_eq!(error, "desktop_auth_callback_path_mismatch");
    }

    #[test]
    fn listens_for_auth_callback_on_localhost() {
        let listener = TcpListener::bind(("127.0.0.1", 0)).expect("expected free port");
        let port = listener.local_addr().expect("expected addr").port();
        drop(listener);

        let thread = std::thread::spawn(move || listen_for_auth_callback(port, "/desktop/auth/callback"));
        std::thread::sleep(std::time::Duration::from_millis(50));

        let mut stream = TcpStream::connect(("127.0.0.1", port)).expect("expected connection");
        stream
            .write_all(
                b"GET /desktop/auth/callback?code=auth_code&state=auth_state HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n",
            )
            .expect("expected request write");
        let mut response = String::new();
        stream.read_to_string(&mut response).expect("expected response");

        let payload = thread.join().expect("expected thread").expect("expected payload");
        assert!(response.contains("200 OK"));
        assert_eq!(payload.code.as_deref(), Some("auth_code"));
        assert_eq!(payload.state.as_deref(), Some("auth_state"));
    }

    #[test]
    fn parses_minimal_brokered_desktop_auth_config() {
        let listener = TcpListener::bind(("127.0.0.1", 0)).expect("expected free port");
        let port = listener.local_addr().expect("expected addr").port();
        let thread = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("expected request");
            let mut request = [0_u8; 2048];
            let _ = stream.read(&mut request).expect("expected request bytes");
            stream
                .write_all(
                    b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n{\"deployment_base_url\":\"http://127.0.0.1:3101\",\"api_base_url\":\"http://127.0.0.1:21000/api/v1\"}",
                )
                .expect("expected response write");
        });

        let config = fetch_desktop_auth_config_from_base_url(&format!("http://127.0.0.1:{port}"))
            .expect("expected minimal brokered config");

        assert_eq!(config.deployment_base_url, "http://127.0.0.1:3101");
        assert_eq!(config.api_base_url.as_deref(), Some("http://127.0.0.1:21000/api/v1"));
        assert_eq!(config.issuer, None);
        assert_eq!(config.authorization_endpoint, None);
        assert_eq!(config.token_endpoint, None);

        thread.join().expect("expected server thread");
    }
}
