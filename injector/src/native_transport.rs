use crate::architecture::{
    TargetArchitecture, inspect_executable_architectures, inspect_runtime_architectures,
    validate_runtime_architecture,
};
use crate::diagnostics::InjectorError;
use crate::process::{
    MinecraftJvmCandidate, ProcessInstanceIdentity, ProcessSnapshot,
    find_owned_minecraft_jvm_candidate,
};
use crate::transport::{
    LoadPreparation, PROTOCOL_VERSION, VersionHandshake, validate_foundation_handshake,
};
use std::collections::{BTreeMap, BTreeSet};
use std::env;
use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{Ipv4Addr, SocketAddr, TcpStream};
#[cfg(unix)]
use std::os::unix::fs::{DirBuilderExt, MetadataExt, OpenOptionsExt, PermissionsExt};
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use std::thread;
use std::time::{Duration, Instant};

pub const NATIVE_TRANSPORT_KIND: &str = "opus-native-transport-runtime";
pub const NATIVE_TRANSPORT_HELPER_ENV: &str = "OPUS_NATIVE_TRANSPORT_HELPER";

const SESSION_SCHEMA_VERSION: u32 = 1;
const SESSION_DIRECTORY_PREFIX: &str = "/tmp/opus-injector-m3-native-";
const SESSION_SUFFIX: &str = ".session";
const DESCRIPTOR_SUFFIX: &str = ".descriptor";
const SESSION_MAX_BYTES: u64 = 4096;
const DESCRIPTOR_MAX_BYTES: u64 = 4096;
const RESPONSE_MAX_BYTES: usize = 4096;
const MAX_PROTOCOL_FIELDS: usize = 16;
const CAPABILITY_BYTES: usize = 32;
const DESCRIPTOR_TIMEOUT: Duration = Duration::from_secs(10);
const POLL_INTERVAL: Duration = Duration::from_millis(20);
const CONNECT_TIMEOUT: Duration = Duration::from_secs(2);
const RESPONSE_TIMEOUT: Duration = Duration::from_secs(5);
const REQUEST_PREFIX: &str = "OPUS_M3_RUNTIME_REQUEST ";
const RESPONSE_PREFIX: &str = "OPUS_M3_RUNTIME_RESPONSE ";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum NativeTransportOperation {
    Load,
    Unload,
    Health,
    Stop,
}

impl NativeTransportOperation {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Load => "load",
            Self::Unload => "unload",
            Self::Health => "health",
            Self::Stop => "stop",
        }
    }

    fn expected_success_code(self) -> &'static str {
        match self {
            Self::Load => "Ready",
            Self::Unload => "Stopped",
            Self::Health => "TargetAlive",
            Self::Stop => "ControlStopped",
        }
    }

    fn required_state(self) -> Option<&'static str> {
        match self {
            Self::Load => Some("running"),
            Self::Unload | Self::Stop => Some("stopped"),
            Self::Health => None,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NativeTransportReport {
    pub pid: u32,
    pub operation: NativeTransportOperation,
    pub target_architecture: TargetArchitecture,
    pub state: String,
    pub runtime_architectures: Option<BTreeSet<TargetArchitecture>>,
}

impl NativeTransportReport {
    pub fn summary(&self) -> String {
        let runtime_architectures = self
            .runtime_architectures
            .as_ref()
            .map(|architectures| {
                architectures
                    .iter()
                    .map(ToString::to_string)
                    .collect::<Vec<_>>()
                    .join(",")
            })
            .unwrap_or_else(|| "not-applicable".to_owned());
        format!(
            "transport=native-macos pid={} operation={} target_architecture={} state={} runtime_architectures={}",
            self.pid,
            self.operation.as_str(),
            self.target_architecture,
            self.state,
            runtime_architectures
        )
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum SessionState {
    LoadPending,
    Running,
    UnloadPending,
    Stopped,
}

impl SessionState {
    fn as_str(self) -> &'static str {
        match self {
            Self::LoadPending => "load-pending",
            Self::Running => "running",
            Self::UnloadPending => "unload-pending",
            Self::Stopped => "stopped",
        }
    }

    fn parse(value: &str) -> Option<Self> {
        match value {
            "load-pending" => Some(Self::LoadPending),
            "running" => Some(Self::Running),
            "unload-pending" => Some(Self::UnloadPending),
            "stopped" => Some(Self::Stopped),
            _ => None,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NativeTransportSession {
    pid: u32,
    owner_uid: u32,
    executable: String,
    process_identity: ProcessInstanceIdentity,
    target_architecture: TargetArchitecture,
    runtime: PathBuf,
    injector_version: String,
    capability: String,
    state: SessionState,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NativeTransportDescriptor {
    path: PathBuf,
    pid: u32,
    port: u16,
    target_architecture: TargetArchitecture,
    capability: String,
    injector_version: String,
    state: String,
}

pub fn request_native_transport_load(
    processes: &[ProcessSnapshot],
    current_user_id: u32,
    preparation: &LoadPreparation,
    runtime_path: &Path,
    helper_path: Option<&Path>,
) -> Result<NativeTransportReport, InjectorError> {
    let target = find_owned_minecraft_jvm_candidate(
        processes,
        preparation.target.process.pid,
        current_user_id,
    )?;
    if target != preparation.target {
        return Err(InjectorError::NativeTransportSessionMismatch {
            pid: target.process.pid,
            detail: "selected process changed after transport preflight".to_owned(),
        });
    }

    let runtime = canonical_runtime(target.process.pid, runtime_path)?;
    let runtime_architectures = inspect_runtime_architectures(&runtime)?;
    validate_runtime_architecture(
        preparation.declared_target_architecture,
        &runtime_architectures,
    )?;
    let identity = process_identity(&target.process)?;
    let existing = read_session_if_present(target.process.pid, current_user_id)?;

    match existing {
        None => {
            remove_descriptor_if_present(target.process.pid, current_user_id)?;
            let session = NativeTransportSession {
                pid: target.process.pid,
                owner_uid: current_user_id,
                executable: target.process.executable.clone(),
                process_identity: identity,
                target_architecture: preparation.declared_target_architecture,
                runtime,
                injector_version: env!("CARGO_PKG_VERSION").to_owned(),
                capability: random_capability()?,
                state: SessionState::LoadPending,
            };
            write_session(&session)?;

            let helper = resolve_helper(preparation.declared_target_architecture, helper_path)?;
            if let Err(error) = invoke_helper(&helper, &session) {
                if matches!(
                    &error,
                    InjectorError::NativeTransportRosettaRemoteThreadUnavailable { .. }
                ) {
                    remove_session(&session)?;
                }
                return Err(error);
            }
            let descriptor = wait_for_descriptor(&session)?;
            validate_live_target_session(&session, current_user_id)?;
            validate_descriptor(&descriptor, &session, Some("running"))?;

            let running_session = NativeTransportSession {
                state: SessionState::Running,
                ..session
            };
            write_session(&running_session)?;
            Ok(NativeTransportReport {
                pid: running_session.pid,
                operation: NativeTransportOperation::Load,
                target_architecture: running_session.target_architecture,
                state: "running".to_owned(),
                runtime_architectures: Some(runtime_architectures),
            })
        }
        Some(session) => {
            validate_session_target(&session, &target)?;
            validate_existing_load_request(
                &session,
                preparation.declared_target_architecture,
                &runtime,
            )?;
            match session.state {
                SessionState::Running => {
                    Err(InjectorError::NativeTransportSessionAlreadyRunning { pid: session.pid })
                }
                SessionState::LoadPending | SessionState::UnloadPending => {
                    Err(InjectorError::NativeTransportSessionRecoveryRequired {
                        pid: session.pid,
                        state: session.state.as_str().to_owned(),
                    })
                }
                SessionState::Stopped => {
                    let descriptor = read_descriptor(&session)?;
                    validate_descriptor(&descriptor, &session, Some("stopped"))?;
                    let pending_session = NativeTransportSession {
                        state: SessionState::LoadPending,
                        ..session
                    };
                    write_session(&pending_session)?;
                    let report = request_control(
                        &pending_session,
                        &descriptor,
                        NativeTransportOperation::Load,
                        Some(runtime_architectures),
                    )?;
                    let running_session = NativeTransportSession {
                        state: SessionState::Running,
                        ..pending_session
                    };
                    write_session(&running_session)?;
                    Ok(report)
                }
            }
        }
    }
}

pub fn request_native_transport_unload(
    processes: &[ProcessSnapshot],
    current_user_id: u32,
    pid: u32,
) -> Result<NativeTransportReport, InjectorError> {
    let target = find_owned_minecraft_jvm_candidate(processes, pid, current_user_id)?;
    let session = read_session_if_present(pid, current_user_id)?
        .ok_or(InjectorError::NativeTransportSessionMissing { pid })?;
    validate_session_target(&session, &target)?;
    if session.state != SessionState::Running {
        return Err(InjectorError::NativeTransportSessionNotRunning { pid });
    }
    let descriptor = read_descriptor(&session)?;
    validate_descriptor(&descriptor, &session, Some("running"))?;

    let pending_session = NativeTransportSession {
        state: SessionState::UnloadPending,
        ..session
    };
    write_session(&pending_session)?;
    let report = request_control(
        &pending_session,
        &descriptor,
        NativeTransportOperation::Unload,
        None,
    )?;
    let stopped_session = NativeTransportSession {
        state: SessionState::Stopped,
        ..pending_session
    };
    write_session(&stopped_session)?;
    Ok(report)
}

pub fn request_native_transport_health(
    processes: &[ProcessSnapshot],
    current_user_id: u32,
    pid: u32,
) -> Result<NativeTransportReport, InjectorError> {
    let target = find_owned_minecraft_jvm_candidate(processes, pid, current_user_id)?;
    let session = read_session_if_present(pid, current_user_id)?
        .ok_or(InjectorError::NativeTransportSessionMissing { pid })?;
    validate_session_target(&session, &target)?;
    if matches!(
        session.state,
        SessionState::LoadPending | SessionState::UnloadPending
    ) {
        return Err(InjectorError::NativeTransportSessionRecoveryRequired {
            pid,
            state: session.state.as_str().to_owned(),
        });
    }
    let descriptor = read_descriptor(&session)?;
    validate_descriptor(&descriptor, &session, Some(session.state.as_str()))?;
    request_control(
        &session,
        &descriptor,
        NativeTransportOperation::Health,
        None,
    )
}

pub fn request_native_transport_stop(
    processes: &[ProcessSnapshot],
    current_user_id: u32,
    pid: u32,
) -> Result<NativeTransportReport, InjectorError> {
    let target = find_owned_minecraft_jvm_candidate(processes, pid, current_user_id)?;
    let session = read_session_if_present(pid, current_user_id)?
        .ok_or(InjectorError::NativeTransportSessionMissing { pid })?;
    validate_session_target(&session, &target)?;
    if session.state != SessionState::Stopped {
        return Err(InjectorError::NativeTransportSessionNotRunning { pid });
    }
    let descriptor = read_descriptor(&session)?;
    validate_descriptor(&descriptor, &session, Some("stopped"))?;
    let report = request_control(&session, &descriptor, NativeTransportOperation::Stop, None)?;
    remove_session(&session)?;
    Ok(report)
}

fn canonical_runtime(pid: u32, runtime: &Path) -> Result<PathBuf, InjectorError> {
    runtime
        .canonicalize()
        .map_err(|_| InjectorError::RuntimeArtifactMissing {
            path: runtime.to_path_buf(),
        })
        .and_then(|path| {
            if path.is_file() {
                Ok(path)
            } else {
                Err(InjectorError::NativeTransportSessionMismatch {
                    pid,
                    detail: "requested runtime is not a regular file".to_owned(),
                })
            }
        })
}

fn process_identity(process: &ProcessSnapshot) -> Result<ProcessInstanceIdentity, InjectorError> {
    process
        .instance_identity()
        .ok_or(InjectorError::NativeTransportProcessIdentityUnavailable { pid: process.pid })
}

fn validate_existing_load_request(
    session: &NativeTransportSession,
    target_architecture: TargetArchitecture,
    runtime: &Path,
) -> Result<(), InjectorError> {
    if session.target_architecture != target_architecture {
        return Err(InjectorError::NativeTransportSessionMismatch {
            pid: session.pid,
            detail: "stored target architecture differs from the requested target".to_owned(),
        });
    }
    if session.runtime != runtime {
        return Err(InjectorError::NativeTransportSessionMismatch {
            pid: session.pid,
            detail: "stored runtime path differs from the requested runtime".to_owned(),
        });
    }
    Ok(())
}

fn validate_session_target(
    session: &NativeTransportSession,
    target: &MinecraftJvmCandidate,
) -> Result<(), InjectorError> {
    let identity = process_identity(&target.process)?;
    if session.pid != target.process.pid
        || session.owner_uid != target.process.owner_uid.unwrap_or_default()
        || session.executable != target.process.executable
        || session.process_identity != identity
    {
        return Err(InjectorError::NativeTransportSessionMismatch {
            pid: target.process.pid,
            detail: "stored session does not match the selected Minecraft JVM process instance"
                .to_owned(),
        });
    }
    Ok(())
}

fn validate_live_target_session(
    session: &NativeTransportSession,
    current_user_id: u32,
) -> Result<(), InjectorError> {
    let processes = crate::process::inspect_system_processes()?;
    let target = find_owned_minecraft_jvm_candidate(&processes, session.pid, current_user_id)?;
    validate_session_target(session, &target)
}

fn helper_default_path(target_architecture: TargetArchitecture) -> PathBuf {
    PathBuf::from("output")
        .join("injector-native-transport")
        .join(target_architecture.to_string())
        .join("opus-macos-transport")
}

fn resolve_helper(
    target_architecture: TargetArchitecture,
    explicit_path: Option<&Path>,
) -> Result<PathBuf, InjectorError> {
    if let Some(path) = explicit_path {
        return canonical_helper_path(path);
    }
    if let Some(path) = env::var_os(NATIVE_TRANSPORT_HELPER_ENV) {
        return canonical_helper_path(Path::new(&path));
    }

    if let Ok(current_directory) = env::current_dir() {
        for ancestor in current_directory.ancestors() {
            let candidate = ancestor
                .join("output")
                .join("injector-native-transport")
                .join(target_architecture.to_string())
                .join("opus-macos-transport");
            if candidate.is_file() {
                return canonical_helper_path(&candidate);
            }
        }
    }
    Err(InjectorError::NativeTransportHelperMissing {
        path: helper_default_path(target_architecture),
    })
}

fn canonical_helper_path(path: &Path) -> Result<PathBuf, InjectorError> {
    let canonical =
        path.canonicalize()
            .map_err(|_| InjectorError::NativeTransportHelperMissing {
                path: path.to_path_buf(),
            })?;
    if !canonical.is_file() {
        return Err(InjectorError::NativeTransportHelperMissing { path: canonical });
    }
    Ok(canonical)
}

fn invoke_helper(helper: &Path, session: &NativeTransportSession) -> Result<(), InjectorError> {
    let helper_architectures = inspect_executable_architectures(helper)?;
    if !helper_architectures.contains(&session.target_architecture) {
        return Err(InjectorError::NativeTransportHelperFailed {
            operation: "load",
            detail: "helper does not contain the selected target architecture".to_owned(),
        });
    }
    let output = Command::new(helper)
        .arg("load")
        .arg("--pid")
        .arg(session.pid.to_string())
        .arg("--runtime")
        .arg(&session.runtime)
        .output()
        .map_err(|error| InjectorError::NativeTransportHelperFailed {
            operation: "load",
            detail: format!("cannot launch helper: {error}"),
        })?;
    let detail = helper_output_detail(&output);
    if !output.status.success() {
        return Err(native_transport_helper_failure(session.pid, "load", detail));
    }
    let expected_architecture = session.target_architecture.to_string();
    if !detail.contains("code=RemoteDlopenReady")
        || !detail.contains(&format!("target_architecture={expected_architecture}"))
    {
        return Err(InjectorError::NativeTransportHelperFailed {
            operation: "load",
            detail: "helper did not publish the required same-architecture load proof".to_owned(),
        });
    }
    Ok(())
}

fn native_transport_helper_failure(
    pid: u32,
    operation: &'static str,
    detail: String,
) -> InjectorError {
    if detail.contains("code=RosettaRemoteThreadUnavailable") {
        InjectorError::NativeTransportRosettaRemoteThreadUnavailable { pid }
    } else {
        InjectorError::NativeTransportHelperFailed { operation, detail }
    }
}

fn helper_output_detail(output: &Output) -> String {
    let detail = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    )
    .chars()
    .map(|character| {
        if character.is_control() {
            ' '
        } else {
            character
        }
    })
    .collect::<String>();
    let detail = detail.chars().take(1024).collect::<String>();
    if detail.trim().is_empty() {
        output.status.to_string()
    } else {
        detail.trim().to_owned()
    }
}

fn session_directory(owner_uid: u32) -> PathBuf {
    PathBuf::from(format!("{SESSION_DIRECTORY_PREFIX}{owner_uid}"))
}

fn session_path(owner_uid: u32, pid: u32) -> PathBuf {
    session_directory(owner_uid).join(format!("{pid}{SESSION_SUFFIX}"))
}

fn descriptor_path(owner_uid: u32, pid: u32) -> PathBuf {
    session_directory(owner_uid).join(format!("{pid}{DESCRIPTOR_SUFFIX}"))
}

fn ensure_private_session_directory(owner_uid: u32) -> Result<PathBuf, InjectorError> {
    let directory = session_directory(owner_uid);
    if !directory.exists() {
        let mut builder = fs::DirBuilder::new();
        builder.recursive(true);
        #[cfg(unix)]
        builder.mode(0o700);
        builder.create(&directory).map_err(|error| {
            InjectorError::NativeTransportSessionStorageFailed {
                detail: format!("cannot create native transport session directory: {error}"),
            }
        })?;
    }
    validate_private_directory(&directory, owner_uid)?;
    #[cfg(unix)]
    fs::set_permissions(&directory, fs::Permissions::from_mode(0o700)).map_err(|error| {
        InjectorError::NativeTransportSessionStorageFailed {
            detail: format!("cannot secure native transport session directory: {error}"),
        }
    })?;
    Ok(directory)
}

fn validate_private_directory(path: &Path, owner_uid: u32) -> Result<(), InjectorError> {
    let metadata = fs::symlink_metadata(path).map_err(|error| {
        InjectorError::NativeTransportSessionStorageFailed {
            detail: format!("cannot inspect native transport session directory: {error}"),
        }
    })?;
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return Err(InjectorError::NativeTransportSessionStorageFailed {
            detail: "native transport session path is not a regular directory".to_owned(),
        });
    }
    #[cfg(unix)]
    if metadata.uid() != owner_uid || metadata.mode() & 0o077 != 0 {
        return Err(InjectorError::NativeTransportSessionStorageFailed {
            detail: "native transport session directory is not private to the current user"
                .to_owned(),
        });
    }
    Ok(())
}

fn validate_private_file(
    path: &Path,
    owner_uid: u32,
    pid: u32,
    label: &str,
    maximum_bytes: u64,
) -> Result<(), InjectorError> {
    let metadata = fs::symlink_metadata(path).map_err(|error| {
        InjectorError::NativeTransportSessionInvalid {
            pid,
            detail: format!("cannot inspect {label}: {error}"),
        }
    })?;
    if !metadata.is_file()
        || metadata.file_type().is_symlink()
        || metadata.len() == 0
        || metadata.len() > maximum_bytes
    {
        return Err(InjectorError::NativeTransportSessionInvalid {
            pid,
            detail: format!("{label} must be a non-empty bounded regular file"),
        });
    }
    #[cfg(unix)]
    if metadata.uid() != owner_uid || metadata.mode() & 0o077 != 0 || metadata.nlink() != 1 {
        return Err(InjectorError::NativeTransportSessionInvalid {
            pid,
            detail: format!("{label} must be private to the current user"),
        });
    }
    Ok(())
}

fn read_session_if_present(
    pid: u32,
    owner_uid: u32,
) -> Result<Option<NativeTransportSession>, InjectorError> {
    let directory = session_directory(owner_uid);
    if !directory.exists() {
        return Ok(None);
    }
    validate_private_directory(&directory, owner_uid)?;
    let path = session_path(owner_uid, pid);
    if !path.exists() {
        return Ok(None);
    }
    validate_private_file(
        &path,
        owner_uid,
        pid,
        "native transport session",
        SESSION_MAX_BYTES,
    )?;
    let contents = fs::read_to_string(&path).map_err(|error| {
        InjectorError::NativeTransportSessionInvalid {
            pid,
            detail: format!("cannot read native transport session: {error}"),
        }
    })?;
    parse_session(&contents, pid, owner_uid).map(Some)
}

fn write_session(session: &NativeTransportSession) -> Result<(), InjectorError> {
    let directory = ensure_private_session_directory(session.owner_uid)?;
    let path = session_path(session.owner_uid, session.pid);
    let temporary_path = directory.join(format!(".{}.{}.tmp", session.pid, random_capability()?));
    let contents = render_session(session);
    #[cfg(unix)]
    let mut output = OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(&temporary_path)
        .map_err(|error| InjectorError::NativeTransportSessionStorageFailed {
            detail: format!("cannot create native transport session: {error}"),
        })?;
    #[cfg(not(unix))]
    let mut output = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary_path)
        .map_err(|error| InjectorError::NativeTransportSessionStorageFailed {
            detail: format!("cannot create native transport session: {error}"),
        })?;
    output
        .write_all(contents.as_bytes())
        .and_then(|()| output.sync_all())
        .map_err(|error| InjectorError::NativeTransportSessionStorageFailed {
            detail: format!("cannot write native transport session: {error}"),
        })?;
    fs::rename(&temporary_path, &path).map_err(|error| {
        InjectorError::NativeTransportSessionStorageFailed {
            detail: format!("cannot publish native transport session: {error}"),
        }
    })?;
    #[cfg(unix)]
    fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).map_err(|error| {
        InjectorError::NativeTransportSessionStorageFailed {
            detail: format!("cannot secure native transport session: {error}"),
        }
    })?;
    Ok(())
}

fn remove_session(session: &NativeTransportSession) -> Result<(), InjectorError> {
    let path = session_path(session.owner_uid, session.pid);
    if !path.exists() {
        return Ok(());
    }
    validate_private_file(
        &path,
        session.owner_uid,
        session.pid,
        "native transport session",
        SESSION_MAX_BYTES,
    )?;
    fs::remove_file(&path).map_err(|error| InjectorError::NativeTransportSessionStorageFailed {
        detail: format!("cannot remove stopped native transport session: {error}"),
    })
}

fn remove_descriptor_if_present(pid: u32, owner_uid: u32) -> Result<(), InjectorError> {
    let directory = ensure_private_session_directory(owner_uid)?;
    let path = directory.join(format!("{pid}{DESCRIPTOR_SUFFIX}"));
    if !path.exists() {
        return Ok(());
    }
    validate_private_file(
        &path,
        owner_uid,
        pid,
        "stale native transport descriptor",
        DESCRIPTOR_MAX_BYTES,
    )?;
    fs::remove_file(&path).map_err(|error| InjectorError::NativeTransportSessionStorageFailed {
        detail: format!("cannot remove stale native transport descriptor: {error}"),
    })
}

fn render_session(session: &NativeTransportSession) -> String {
    format!(
        concat!(
            "schemaVersion={}\n",
            "pid={}\n",
            "ownerUid={}\n",
            "targetExecutable={}\n",
            "processStartTime={}\n",
            "commandFingerprint={}\n",
            "targetArchitecture={}\n",
            "runtime={}\n",
            "injectorVersion={}\n",
            "capability={}\n",
            "state={}\n"
        ),
        SESSION_SCHEMA_VERSION,
        session.pid,
        session.owner_uid,
        percent_encode(&session.executable),
        percent_encode(&session.process_identity.started_at),
        session.process_identity.command_fingerprint,
        session.target_architecture,
        percent_encode(&session.runtime.to_string_lossy()),
        session.injector_version,
        session.capability,
        session.state.as_str(),
    )
}

fn parse_session(
    contents: &str,
    expected_pid: u32,
    expected_owner_uid: u32,
) -> Result<NativeTransportSession, InjectorError> {
    let fields = parse_properties(contents, expected_pid, "session")?;
    const REQUIRED: &[&str] = &[
        "schemaVersion",
        "pid",
        "ownerUid",
        "targetExecutable",
        "processStartTime",
        "commandFingerprint",
        "targetArchitecture",
        "runtime",
        "injectorVersion",
        "capability",
        "state",
    ];
    validate_exact_fields(&fields, REQUIRED, expected_pid, "session")?;

    let schema_version = parse_field_u32(&fields, "schemaVersion", expected_pid, "session")?;
    if schema_version != SESSION_SCHEMA_VERSION {
        return session_invalid(expected_pid, "session schema version is unsupported");
    }
    let pid = parse_field_u32(&fields, "pid", expected_pid, "session")?;
    if pid != expected_pid {
        return session_invalid(expected_pid, "session pid does not match selected process");
    }
    let owner_uid = parse_field_u32(&fields, "ownerUid", expected_pid, "session")?;
    if owner_uid != expected_owner_uid {
        return session_invalid(expected_pid, "session owner does not match current user");
    }
    let executable = percent_decode(required_field(
        &fields,
        "targetExecutable",
        expected_pid,
        "session",
    )?)
    .filter(|value| !value.is_empty())
    .ok_or_else(|| InjectorError::NativeTransportSessionInvalid {
        pid: expected_pid,
        detail: "session target executable is not valid percent-encoded UTF-8".to_owned(),
    })?;
    let started_at = percent_decode(required_field(
        &fields,
        "processStartTime",
        expected_pid,
        "session",
    )?)
    .filter(|value| !value.trim().is_empty())
    .ok_or_else(|| InjectorError::NativeTransportSessionInvalid {
        pid: expected_pid,
        detail: "session process start time is not valid percent-encoded UTF-8".to_owned(),
    })?;
    let command_fingerprint =
        required_field(&fields, "commandFingerprint", expected_pid, "session")?.to_owned();
    if !is_lower_hex(&command_fingerprint, 16) {
        return session_invalid(expected_pid, "session command fingerprint is invalid");
    }
    let runtime = PathBuf::from(
        percent_decode(required_field(&fields, "runtime", expected_pid, "session")?).ok_or_else(
            || InjectorError::NativeTransportSessionInvalid {
                pid: expected_pid,
                detail: "session runtime path is not valid percent-encoded UTF-8".to_owned(),
            },
        )?,
    );
    let target_architecture = TargetArchitecture::parse(required_field(
        &fields,
        "targetArchitecture",
        expected_pid,
        "session",
    )?)?;
    let injector_version =
        required_field(&fields, "injectorVersion", expected_pid, "session")?.to_owned();
    if !is_safe_token(&injector_version) {
        return session_invalid(expected_pid, "session injector version is invalid");
    }
    let capability = required_field(&fields, "capability", expected_pid, "session")?.to_owned();
    if !is_lower_hex(&capability, CAPABILITY_BYTES * 2) {
        return session_invalid(expected_pid, "session capability is invalid");
    }
    let state = SessionState::parse(required_field(&fields, "state", expected_pid, "session")?)
        .ok_or_else(|| InjectorError::NativeTransportSessionInvalid {
            pid: expected_pid,
            detail: "session state is invalid".to_owned(),
        })?;

    Ok(NativeTransportSession {
        pid,
        owner_uid,
        executable,
        process_identity: ProcessInstanceIdentity {
            started_at,
            command_fingerprint,
        },
        target_architecture,
        runtime,
        injector_version,
        capability,
        state,
    })
}

fn wait_for_descriptor(
    session: &NativeTransportSession,
) -> Result<NativeTransportDescriptor, InjectorError> {
    let deadline = Instant::now() + DESCRIPTOR_TIMEOUT;
    loop {
        let path = descriptor_path(session.owner_uid, session.pid);
        if path.exists() {
            return read_descriptor(session);
        }
        if Instant::now() >= deadline {
            return Err(InjectorError::NativeTransportDescriptorMissing {
                pid: session.pid,
                path,
            });
        }
        thread::sleep(POLL_INTERVAL);
    }
}

fn read_descriptor(
    session: &NativeTransportSession,
) -> Result<NativeTransportDescriptor, InjectorError> {
    let directory = session_directory(session.owner_uid);
    validate_private_directory(&directory, session.owner_uid)?;
    let path = descriptor_path(session.owner_uid, session.pid);
    if !path.exists() {
        return Err(InjectorError::NativeTransportDescriptorMissing {
            pid: session.pid,
            path,
        });
    }
    validate_private_file(
        &path,
        session.owner_uid,
        session.pid,
        "native transport descriptor",
        DESCRIPTOR_MAX_BYTES,
    )
    .map_err(|error| descriptor_error_from_session_error(error, session.pid))?;
    let contents = fs::read_to_string(&path).map_err(|error| {
        InjectorError::NativeTransportDescriptorInvalid {
            pid: session.pid,
            detail: format!("cannot read native transport descriptor: {error}"),
        }
    })?;
    parse_descriptor(&contents, path, session.pid)
}

fn descriptor_error_from_session_error(error: InjectorError, pid: u32) -> InjectorError {
    match error {
        InjectorError::NativeTransportSessionInvalid { detail, .. } => {
            InjectorError::NativeTransportDescriptorInvalid { pid, detail }
        }
        InjectorError::NativeTransportSessionStorageFailed { detail } => {
            InjectorError::NativeTransportDescriptorInvalid { pid, detail }
        }
        other => other,
    }
}

fn parse_descriptor(
    contents: &str,
    path: PathBuf,
    expected_pid: u32,
) -> Result<NativeTransportDescriptor, InjectorError> {
    let fields = parse_properties(contents, expected_pid, "descriptor")
        .map_err(|error| descriptor_error_from_session_error(error, expected_pid))?;
    const REQUIRED: &[&str] = &[
        "protocolVersion",
        "targetKind",
        "pid",
        "port",
        "targetArchitecture",
        "capability",
        "injectorVersion",
        "nativeRuntimeVersion",
        "javaRuntimeVersion",
        "mappingSchemaVersion",
        "oneConfigAdapterVersion",
        "artifactChecksums",
        "state",
    ];
    validate_exact_fields(&fields, REQUIRED, expected_pid, "descriptor")
        .map_err(|error| descriptor_error_from_session_error(error, expected_pid))?;

    let protocol_version = parse_field_u32(&fields, "protocolVersion", expected_pid, "descriptor")
        .map_err(|error| descriptor_error_from_session_error(error, expected_pid))?;
    if protocol_version != PROTOCOL_VERSION {
        return Err(InjectorError::HandshakeProtocolMismatch {
            expected: PROTOCOL_VERSION,
            actual: protocol_version,
        });
    }
    if required_field(&fields, "targetKind", expected_pid, "descriptor")
        .map_err(|error| descriptor_error_from_session_error(error, expected_pid))?
        != NATIVE_TRANSPORT_KIND
    {
        return Err(InjectorError::NativeTransportDescriptorInvalid {
            pid: expected_pid,
            detail: "descriptor target kind does not match native transport".to_owned(),
        });
    }
    let pid = parse_field_u32(&fields, "pid", expected_pid, "descriptor")
        .map_err(|error| descriptor_error_from_session_error(error, expected_pid))?;
    if pid != expected_pid {
        return Err(InjectorError::NativeTransportDescriptorInvalid {
            pid: expected_pid,
            detail: "descriptor pid does not match selected process".to_owned(),
        });
    }
    let port = required_field(&fields, "port", expected_pid, "descriptor")
        .map_err(|error| descriptor_error_from_session_error(error, expected_pid))?
        .parse::<u16>()
        .ok()
        .filter(|value| *value != 0)
        .ok_or_else(|| InjectorError::NativeTransportDescriptorInvalid {
            pid: expected_pid,
            detail: "descriptor port is invalid".to_owned(),
        })?;
    let target_architecture = TargetArchitecture::parse(
        required_field(&fields, "targetArchitecture", expected_pid, "descriptor")
            .map_err(|error| descriptor_error_from_session_error(error, expected_pid))?,
    )?;
    let capability = required_field(&fields, "capability", expected_pid, "descriptor")
        .map_err(|error| descriptor_error_from_session_error(error, expected_pid))?
        .to_owned();
    if !is_lower_hex(&capability, CAPABILITY_BYTES * 2) {
        return Err(InjectorError::NativeTransportDescriptorInvalid {
            pid: expected_pid,
            detail: "descriptor capability is invalid".to_owned(),
        });
    }
    let injector_version = required_field(&fields, "injectorVersion", expected_pid, "descriptor")
        .map_err(|error| descriptor_error_from_session_error(error, expected_pid))?
        .to_owned();
    if !is_safe_token(&injector_version) {
        return Err(InjectorError::NativeTransportDescriptorInvalid {
            pid: expected_pid,
            detail: "descriptor injector version is invalid".to_owned(),
        });
    }
    let handshake = VersionHandshake {
        protocol_version,
        injector_version: injector_version.clone(),
        native_runtime_version: required_field(
            &fields,
            "nativeRuntimeVersion",
            expected_pid,
            "descriptor",
        )
        .map_err(|error| descriptor_error_from_session_error(error, expected_pid))?
        .to_owned(),
        java_runtime_version: required_field(
            &fields,
            "javaRuntimeVersion",
            expected_pid,
            "descriptor",
        )
        .map_err(|error| descriptor_error_from_session_error(error, expected_pid))?
        .to_owned(),
        target_architecture,
        mapping_schema_version: required_field(
            &fields,
            "mappingSchemaVersion",
            expected_pid,
            "descriptor",
        )
        .map_err(|error| descriptor_error_from_session_error(error, expected_pid))?
        .to_owned(),
        oneconfig_adapter_version: required_field(
            &fields,
            "oneConfigAdapterVersion",
            expected_pid,
            "descriptor",
        )
        .map_err(|error| descriptor_error_from_session_error(error, expected_pid))?
        .to_owned(),
        artifact_checksums: required_field(
            &fields,
            "artifactChecksums",
            expected_pid,
            "descriptor",
        )
        .map_err(|error| descriptor_error_from_session_error(error, expected_pid))?
        .to_owned(),
    };
    validate_foundation_handshake(&handshake, target_architecture)?;
    let state = required_field(&fields, "state", expected_pid, "descriptor")
        .map_err(|error| descriptor_error_from_session_error(error, expected_pid))?
        .to_owned();
    if state != "running" && state != "stopped" {
        return Err(InjectorError::NativeTransportDescriptorInvalid {
            pid: expected_pid,
            detail: "descriptor state is invalid".to_owned(),
        });
    }

    Ok(NativeTransportDescriptor {
        path,
        pid,
        port,
        target_architecture,
        capability,
        injector_version,
        state,
    })
}

fn validate_descriptor(
    descriptor: &NativeTransportDescriptor,
    session: &NativeTransportSession,
    expected_state: Option<&str>,
) -> Result<(), InjectorError> {
    if descriptor.pid != session.pid
        || descriptor.target_architecture != session.target_architecture
        || descriptor.injector_version != session.injector_version
        || descriptor.capability != session.capability
    {
        return Err(InjectorError::NativeTransportDescriptorInvalid {
            pid: session.pid,
            detail: "descriptor does not match the PID-bound native transport session".to_owned(),
        });
    }
    if let Some(expected_state) = expected_state
        && descriptor.state != expected_state
    {
        return Err(InjectorError::NativeTransportDescriptorInvalid {
            pid: session.pid,
            detail: format!(
                "descriptor state {:?} does not match expected state {:?}",
                descriptor.state, expected_state
            ),
        });
    }
    Ok(())
}

fn request_control(
    session: &NativeTransportSession,
    descriptor: &NativeTransportDescriptor,
    operation: NativeTransportOperation,
    runtime_architectures: Option<BTreeSet<TargetArchitecture>>,
) -> Result<NativeTransportReport, InjectorError> {
    let request = render_control_request(session, operation);
    let response = exchange(descriptor, operation, &request)?;
    validate_control_response(
        session,
        descriptor,
        operation,
        &response,
        runtime_architectures,
    )
}

fn render_control_request(
    session: &NativeTransportSession,
    operation: NativeTransportOperation,
) -> String {
    format!(
        "{REQUEST_PREFIX}protocolVersion={PROTOCOL_VERSION};targetKind={NATIVE_TRANSPORT_KIND};operation={};capability={};targetPid={};targetArchitecture={}",
        operation.as_str(),
        session.capability,
        session.pid,
        session.target_architecture
    )
}

fn exchange(
    descriptor: &NativeTransportDescriptor,
    operation: NativeTransportOperation,
    request: &str,
) -> Result<BTreeMap<String, String>, InjectorError> {
    let address = SocketAddr::from((Ipv4Addr::LOCALHOST, descriptor.port));
    let mut stream = TcpStream::connect_timeout(&address, CONNECT_TIMEOUT).map_err(|error| {
        InjectorError::NativeTransportConnectionFailed {
            operation: operation.as_str(),
            detail: format!(
                "cannot connect to selected target {} on loopback port {}: {error}",
                descriptor.pid, descriptor.port
            ),
        }
    })?;
    stream
        .set_read_timeout(Some(RESPONSE_TIMEOUT))
        .and_then(|()| stream.set_write_timeout(Some(RESPONSE_TIMEOUT)))
        .map_err(|error| InjectorError::NativeTransportConnectionFailed {
            operation: operation.as_str(),
            detail: format!("cannot configure loopback transport timeout: {error}"),
        })?;
    stream
        .write_all(request.as_bytes())
        .and_then(|()| stream.write_all(b"\n"))
        .and_then(|()| stream.flush())
        .map_err(|error| InjectorError::NativeTransportConnectionFailed {
            operation: operation.as_str(),
            detail: format!("cannot send native transport request: {error}"),
        })?;
    let mut response = String::new();
    BufReader::new(stream)
        .read_line(&mut response)
        .map_err(|error| InjectorError::NativeTransportConnectionFailed {
            operation: operation.as_str(),
            detail: format!("cannot read native transport response: {error}"),
        })?;
    if response.is_empty() || response.len() > RESPONSE_MAX_BYTES {
        return Err(InjectorError::NativeTransportProtocolError {
            operation: operation.as_str(),
            detail: format!(
                "native transport response must contain between 1 and {RESPONSE_MAX_BYTES} bytes"
            ),
        });
    }
    parse_protocol_response(response.trim_end_matches(['\r', '\n']), operation)
}

fn parse_protocol_response(
    line: &str,
    operation: NativeTransportOperation,
) -> Result<BTreeMap<String, String>, InjectorError> {
    let payload = line.strip_prefix(RESPONSE_PREFIX).ok_or_else(|| {
        InjectorError::NativeTransportProtocolError {
            operation: operation.as_str(),
            detail: "response does not use the native transport protocol prefix".to_owned(),
        }
    })?;
    let mut fields = BTreeMap::new();
    for field in payload.split(';') {
        let (key, value) =
            field
                .split_once('=')
                .ok_or_else(|| InjectorError::NativeTransportProtocolError {
                    operation: operation.as_str(),
                    detail: format!("response field is malformed: {field:?}"),
                })?;
        if key.is_empty()
            || value.is_empty()
            || !is_safe_key(key)
            || fields.insert(key.to_owned(), value.to_owned()).is_some()
        {
            return Err(InjectorError::NativeTransportProtocolError {
                operation: operation.as_str(),
                detail: format!("response field is invalid: {field:?}"),
            });
        }
        if fields.len() > MAX_PROTOCOL_FIELDS {
            return Err(InjectorError::NativeTransportProtocolError {
                operation: operation.as_str(),
                detail: format!("response exceeds {MAX_PROTOCOL_FIELDS} protocol fields"),
            });
        }
    }
    Ok(fields)
}

fn validate_control_response(
    session: &NativeTransportSession,
    descriptor: &NativeTransportDescriptor,
    operation: NativeTransportOperation,
    fields: &BTreeMap<String, String>,
    runtime_architectures: Option<BTreeSet<TargetArchitecture>>,
) -> Result<NativeTransportReport, InjectorError> {
    const REQUIRED: &[&str] = &[
        "protocolVersion",
        "targetKind",
        "operation",
        "targetPid",
        "targetArchitecture",
        "code",
        "injectorVersion",
        "nativeRuntimeVersion",
        "javaRuntimeVersion",
        "mappingSchemaVersion",
        "oneConfigAdapterVersion",
        "artifactChecksums",
        "state",
    ];
    if fields.len() != REQUIRED.len() || fields.keys().any(|key| !REQUIRED.contains(&key.as_str()))
    {
        return Err(InjectorError::NativeTransportProtocolError {
            operation: operation.as_str(),
            detail: "response fields do not match the native transport contract".to_owned(),
        });
    }
    let protocol_version = required_response_field(fields, "protocolVersion", operation)?
        .parse::<u32>()
        .map_err(|_| InjectorError::NativeTransportProtocolError {
            operation: operation.as_str(),
            detail: "response protocolVersion is not an unsigned integer".to_owned(),
        })?;
    if protocol_version != PROTOCOL_VERSION {
        return Err(InjectorError::HandshakeProtocolMismatch {
            expected: PROTOCOL_VERSION,
            actual: protocol_version,
        });
    }
    if required_response_field(fields, "targetKind", operation)? != NATIVE_TRANSPORT_KIND {
        return Err(InjectorError::NativeTransportProtocolError {
            operation: operation.as_str(),
            detail: "response target kind does not match native transport".to_owned(),
        });
    }
    if required_response_field(fields, "operation", operation)? != operation.as_str() {
        return Err(InjectorError::NativeTransportProtocolError {
            operation: operation.as_str(),
            detail: "response operation does not match the request".to_owned(),
        });
    }
    let target_pid = required_response_field(fields, "targetPid", operation)?
        .parse::<u32>()
        .ok()
        .filter(|value| *value != 0)
        .ok_or_else(|| InjectorError::NativeTransportProtocolError {
            operation: operation.as_str(),
            detail: "response targetPid is invalid".to_owned(),
        })?;
    if target_pid != session.pid || target_pid != descriptor.pid {
        return Err(InjectorError::NativeTransportProtocolError {
            operation: operation.as_str(),
            detail: "response targetPid does not match selected process".to_owned(),
        });
    }
    let target_architecture = TargetArchitecture::parse(required_response_field(
        fields,
        "targetArchitecture",
        operation,
    )?)?;
    if target_architecture != session.target_architecture
        || target_architecture != descriptor.target_architecture
    {
        return Err(InjectorError::HandshakeArchitectureMismatch {
            expected: session.target_architecture,
            actual: target_architecture,
        });
    }
    let handshake = VersionHandshake {
        protocol_version,
        injector_version: required_response_field(fields, "injectorVersion", operation)?.to_owned(),
        native_runtime_version: required_response_field(fields, "nativeRuntimeVersion", operation)?
            .to_owned(),
        java_runtime_version: required_response_field(fields, "javaRuntimeVersion", operation)?
            .to_owned(),
        target_architecture,
        mapping_schema_version: required_response_field(fields, "mappingSchemaVersion", operation)?
            .to_owned(),
        oneconfig_adapter_version: required_response_field(
            fields,
            "oneConfigAdapterVersion",
            operation,
        )?
        .to_owned(),
        artifact_checksums: required_response_field(fields, "artifactChecksums", operation)?
            .to_owned(),
    };
    validate_foundation_handshake(&handshake, session.target_architecture)?;
    if handshake.injector_version != session.injector_version {
        return Err(InjectorError::NativeTransportProtocolError {
            operation: operation.as_str(),
            detail: "response injector version does not match the PID-bound session".to_owned(),
        });
    }
    let code = required_response_field(fields, "code", operation)?;
    if code != operation.expected_success_code() {
        return Err(InjectorError::NativeTransportRejected {
            operation: operation.as_str(),
            code: code.to_owned(),
        });
    }
    let state = required_response_field(fields, "state", operation)?.to_owned();
    if let Some(required_state) = operation.required_state()
        && state != required_state
    {
        return Err(InjectorError::NativeTransportProtocolError {
            operation: operation.as_str(),
            detail: format!("response state {state:?} must be {required_state:?}"),
        });
    }

    Ok(NativeTransportReport {
        pid: target_pid,
        operation,
        target_architecture,
        state,
        runtime_architectures,
    })
}

fn parse_properties(
    contents: &str,
    pid: u32,
    label: &str,
) -> Result<BTreeMap<String, String>, InjectorError> {
    let mut fields = BTreeMap::new();
    for line in contents.lines() {
        let (key, value) =
            line.split_once('=')
                .ok_or_else(|| InjectorError::NativeTransportSessionInvalid {
                    pid,
                    detail: format!("{label} contains a malformed field"),
                })?;
        if key.is_empty()
            || value.is_empty()
            || !is_safe_key(key)
            || value.contains(['\r', '\n', '\0'])
            || fields.insert(key.to_owned(), value.to_owned()).is_some()
        {
            return Err(InjectorError::NativeTransportSessionInvalid {
                pid,
                detail: format!("{label} contains an invalid or duplicate field"),
            });
        }
    }
    if fields.is_empty() {
        return session_invalid(pid, &format!("{label} is empty"));
    }
    Ok(fields)
}

fn validate_exact_fields(
    fields: &BTreeMap<String, String>,
    required: &[&str],
    pid: u32,
    label: &str,
) -> Result<(), InjectorError> {
    if fields.len() != required.len() || fields.keys().any(|key| !required.contains(&key.as_str()))
    {
        return session_invalid(
            pid,
            &format!("{label} fields do not match the native transport contract"),
        );
    }
    Ok(())
}

fn required_field<'a>(
    fields: &'a BTreeMap<String, String>,
    field: &str,
    pid: u32,
    label: &str,
) -> Result<&'a str, InjectorError> {
    fields.get(field).map(String::as_str).ok_or_else(|| {
        InjectorError::NativeTransportSessionInvalid {
            pid,
            detail: format!("{label} is missing {field}"),
        }
    })
}

fn parse_field_u32(
    fields: &BTreeMap<String, String>,
    field: &str,
    pid: u32,
    label: &str,
) -> Result<u32, InjectorError> {
    required_field(fields, field, pid, label)?
        .parse::<u32>()
        .ok()
        .filter(|value| *value != 0)
        .ok_or_else(|| InjectorError::NativeTransportSessionInvalid {
            pid,
            detail: format!("{label} {field} is not a non-zero unsigned integer"),
        })
}

fn required_response_field<'a>(
    fields: &'a BTreeMap<String, String>,
    field: &str,
    operation: NativeTransportOperation,
) -> Result<&'a str, InjectorError> {
    fields.get(field).map(String::as_str).ok_or_else(|| {
        InjectorError::NativeTransportProtocolError {
            operation: operation.as_str(),
            detail: format!("response is missing {field}"),
        }
    })
}

fn session_invalid<T>(pid: u32, detail: &str) -> Result<T, InjectorError> {
    Err(InjectorError::NativeTransportSessionInvalid {
        pid,
        detail: detail.to_owned(),
    })
}

fn is_safe_key(value: &str) -> bool {
    !value.is_empty() && value.bytes().all(|byte| byte.is_ascii_alphanumeric())
}

fn is_safe_token(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
}

fn is_lower_hex(value: &str, expected_length: usize) -> bool {
    value.len() == expected_length
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || matches!(byte, b'a'..=b'f'))
}

fn random_capability() -> Result<String, InjectorError> {
    let mut bytes = [0u8; CAPABILITY_BYTES];
    File::open("/dev/urandom")
        .and_then(|mut source| source.read_exact(&mut bytes))
        .map_err(|error| InjectorError::NativeTransportSessionStorageFailed {
            detail: format!("cannot generate native transport capability: {error}"),
        })?;
    Ok(bytes
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>())
}

fn percent_encode(value: &str) -> String {
    value
        .as_bytes()
        .iter()
        .flat_map(|byte| {
            if byte.is_ascii_alphanumeric() || matches!(*byte, b'-' | b'.' | b'_' | b'~') {
                vec![char::from(*byte)]
            } else {
                format!("%{byte:02X}").chars().collect()
            }
        })
        .collect()
}

fn percent_decode(value: &str) -> Option<String> {
    let mut bytes = Vec::with_capacity(value.len());
    let mut iterator = value.as_bytes().iter().copied();
    while let Some(byte) = iterator.next() {
        if byte != b'%' {
            bytes.push(byte);
            continue;
        }
        let high = hex_value(iterator.next()?)?;
        let low = hex_value(iterator.next()?)?;
        bytes.push((high << 4) | low);
    }
    String::from_utf8(bytes).ok()
}

fn hex_value(value: u8) -> Option<u8> {
    match value {
        b'0'..=b'9' => Some(value - b'0'),
        b'a'..=b'f' => Some(value - b'a' + 10),
        b'A'..=b'F' => Some(value - b'A' + 10),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::{
        NativeTransportSession, SessionState, native_transport_helper_failure, parse_descriptor,
        parse_session, percent_decode, percent_encode, render_session,
    };
    use crate::architecture::TargetArchitecture;
    use crate::diagnostics::InjectorError;
    use crate::process::ProcessInstanceIdentity;
    use std::path::PathBuf;

    fn session() -> NativeTransportSession {
        NativeTransportSession {
            pid: 42,
            owner_uid: 501,
            executable: "/usr/bin/java".to_owned(),
            process_identity: ProcessInstanceIdentity {
                started_at: "Thu Sep 10 12:00:00 2026".to_owned(),
                command_fingerprint: "0123456789abcdef".to_owned(),
            },
            target_architecture: TargetArchitecture::Arm64,
            runtime: PathBuf::from("/tmp/libopus-runtime.dylib"),
            injector_version: "0.1.0".to_owned(),
            capability: "a".repeat(64),
            state: SessionState::LoadPending,
        }
    }

    #[test]
    fn round_trips_a_private_native_transport_session() {
        let rendered = render_session(&session());
        let parsed = parse_session(&rendered, 42, 501).expect("session should parse");
        assert_eq!(parsed, session());
    }

    #[test]
    fn percent_codec_round_trips_runtime_paths() {
        let value = "/tmp/opus runtime=1.dylib";
        assert_eq!(
            percent_decode(&percent_encode(value)).as_deref(),
            Some(value)
        );
    }

    #[test]
    fn rejects_a_descriptor_with_a_foreign_capability() {
        let descriptor = concat!(
            "protocolVersion=1\n",
            "targetKind=opus-native-transport-runtime\n",
            "pid=42\n",
            "port=12345\n",
            "targetArchitecture=arm64\n",
            "capability=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n",
            "injectorVersion=0.1.0\n",
            "nativeRuntimeVersion=0.1.0\n",
            "javaRuntimeVersion=not-built\n",
            "mappingSchemaVersion=not-applicable\n",
            "oneConfigAdapterVersion=not-loaded\n",
            "artifactChecksums=not-packaged\n",
            "state=running\n"
        );
        let parsed = parse_descriptor(descriptor, PathBuf::from("/tmp/42.descriptor"), 42)
            .expect("descriptor syntax should parse");
        assert_eq!(parsed.capability, "b".repeat(64));
    }

    #[test]
    fn maps_a_rosetta_remote_thread_failure_to_a_typed_diagnostic() {
        let error = native_transport_helper_failure(
            42,
            "load",
            "[OPUS/MACOS-TRANSPORT] code=RosettaRemoteThreadUnavailable message=mach_error=(os/kern) invalid argument".to_owned(),
        );
        assert!(matches!(
            error,
            InjectorError::NativeTransportRosettaRemoteThreadUnavailable { pid: 42 }
        ));
    }
}
