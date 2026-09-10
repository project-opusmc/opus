use crate::architecture::{
    TargetArchitecture, inspect_runtime_architectures, validate_runtime_architecture,
};
use crate::diagnostics::InjectorError;
use crate::process::{ProcessInstanceIdentity, ProcessSnapshot, find_owned_attach_harness};
use crate::transport::{PROTOCOL_VERSION, VersionHandshake, validate_foundation_handshake};
use std::collections::BTreeMap;
use std::env;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
#[cfg(unix)]
use std::os::unix::fs::{DirBuilderExt, MetadataExt, OpenOptionsExt, PermissionsExt};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

pub const ATTACH_HARNESS_HELPER_MAIN_CLASS: &str = "dev.opus.runtime.harness.AttachHarnessMain";

const ATTACH_TIMEOUT: Duration = Duration::from_secs(10);
const SESSION_SCHEMA_VERSION: u32 = 2;
const CAPABILITY_BYTES: usize = 32;
const JDK8_AGENT_LOAD_COMPLETION_QUIRK: &str = "AgentLoadException:Failed to load agent library: 0";

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct JvmAttachConfig {
    pub java: PathBuf,
    pub classpath: PathBuf,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum JvmAttachOperation {
    Load,
    Unload,
}

impl JvmAttachOperation {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Load => "load",
            Self::Unload => "unload",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct JvmAttachReport {
    pub pid: u32,
    pub operation: JvmAttachOperation,
    pub target_architecture: TargetArchitecture,
    pub state: String,
}

impl JvmAttachReport {
    pub fn summary(&self) -> String {
        format!(
            "transport=jvm-attach pid={} operation={} target_architecture={} state={}",
            self.pid,
            self.operation.as_str(),
            self.target_architecture,
            self.state
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
struct JvmAttachSession {
    pid: u32,
    owner_uid: u32,
    executable: String,
    process_identity: ProcessInstanceIdentity,
    target_architecture: TargetArchitecture,
    runtime: PathBuf,
    state: SessionState,
}

struct HelperOutcome {
    succeeded: bool,
    detail: String,
}

pub fn request_jvm_attach_harness_load(
    processes: &[ProcessSnapshot],
    pid: u32,
    current_user_id: u32,
    target_architecture: TargetArchitecture,
    runtime_path: &Path,
    config: &JvmAttachConfig,
) -> Result<JvmAttachReport, InjectorError> {
    validate_attach_config(config)?;
    let target = find_owned_attach_harness(processes, pid, current_user_id)?;
    let owner_uid = current_owner_uid(&target)?;
    let runtime = canonical_runtime(target.pid, runtime_path)?;
    let runtime_architectures = inspect_runtime_architectures(&runtime)?;
    validate_runtime_architecture(target_architecture, &runtime_architectures)?;
    let process_identity = target_instance_identity(&target)?;
    let session = read_session_if_present(target.pid, owner_uid)?;
    if let Some(existing) = session.as_ref() {
        validate_session_target(existing, &target)?;
        if existing.target_architecture != target_architecture {
            return Err(InjectorError::JvmAttachSessionMismatch {
                pid: target.pid,
                detail: "stored target architecture differs from the selected target".to_owned(),
            });
        }
        if existing.runtime != runtime {
            return Err(InjectorError::JvmAttachSessionMismatch {
                pid: target.pid,
                detail: "stored runtime path differs from the requested runtime".to_owned(),
            });
        }
        match existing.state {
            SessionState::Running => {
                return Err(InjectorError::JvmAttachSessionAlreadyRunning { pid: target.pid });
            }
            SessionState::LoadPending | SessionState::UnloadPending => {
                return Err(InjectorError::JvmAttachSessionRecoveryRequired {
                    pid: target.pid,
                    state: existing.state.as_str().to_owned(),
                });
            }
            SessionState::Stopped => {}
        }
    }

    let pending_session = JvmAttachSession {
        pid: target.pid,
        owner_uid,
        executable: target.executable.clone(),
        process_identity,
        target_architecture,
        runtime,
        state: SessionState::LoadPending,
    };
    write_session(&pending_session)?;
    let report = invoke_agent(
        &target,
        owner_uid,
        target_architecture,
        &pending_session.runtime,
        JvmAttachOperation::Load,
        config,
    )?;
    write_session(&JvmAttachSession {
        state: SessionState::Running,
        ..pending_session
    })?;
    Ok(report)
}

pub fn request_jvm_attach_harness_unload(
    processes: &[ProcessSnapshot],
    pid: u32,
    current_user_id: u32,
    config: &JvmAttachConfig,
) -> Result<JvmAttachReport, InjectorError> {
    validate_attach_config(config)?;
    let target = find_owned_attach_harness(processes, pid, current_user_id)?;
    let owner_uid = current_owner_uid(&target)?;
    let session = read_session_if_present(pid, owner_uid)?
        .ok_or(InjectorError::JvmAttachSessionMissing { pid })?;
    validate_session_target(&session, &target)?;
    if session.state == SessionState::Stopped {
        return Err(InjectorError::JvmAttachSessionNotRunning { pid });
    }

    let runtime_architectures = inspect_runtime_architectures(&session.runtime)?;
    validate_runtime_architecture(session.target_architecture, &runtime_architectures)?;
    let pending_session = JvmAttachSession {
        state: SessionState::UnloadPending,
        ..session
    };
    write_session(&pending_session)?;
    let report = invoke_agent(
        &target,
        owner_uid,
        pending_session.target_architecture,
        &pending_session.runtime,
        JvmAttachOperation::Unload,
        config,
    )?;
    write_session(&JvmAttachSession {
        state: SessionState::Stopped,
        ..pending_session
    })?;
    Ok(report)
}

fn current_owner_uid(process: &ProcessSnapshot) -> Result<u32, InjectorError> {
    process
        .owner_uid
        .ok_or(InjectorError::TargetOwnershipUnknown { pid: process.pid })
}

fn target_instance_identity(
    process: &ProcessSnapshot,
) -> Result<ProcessInstanceIdentity, InjectorError> {
    process
        .instance_identity()
        .ok_or(InjectorError::JvmAttachProcessIdentityUnavailable { pid: process.pid })
}

fn canonical_runtime(pid: u32, runtime: &Path) -> Result<PathBuf, InjectorError> {
    runtime
        .canonicalize()
        .map_err(|_| InjectorError::JvmAttachRuntimeMissing {
            pid,
            path: runtime.to_path_buf(),
        })
}

fn validate_attach_config(config: &JvmAttachConfig) -> Result<(), InjectorError> {
    if !(config.classpath.is_file() || config.classpath.is_dir()) {
        return Err(InjectorError::JvmAttachHelperClasspathMissing {
            path: config.classpath.clone(),
        });
    }
    if config.java.as_os_str().is_empty() {
        return Err(InjectorError::InvalidArguments {
            message: "--attach-java must not be empty".to_owned(),
        });
    }
    Ok(())
}

fn invoke_agent(
    target: &ProcessSnapshot,
    owner_uid: u32,
    target_architecture: TargetArchitecture,
    runtime: &Path,
    operation: JvmAttachOperation,
    config: &JvmAttachConfig,
) -> Result<JvmAttachReport, InjectorError> {
    let report_directory = ensure_private_session_directory(owner_uid)?;
    let capability = random_capability()?;
    let report_path = report_directory.join(format!(
        "agent-{}-{}-{}.properties",
        target.pid,
        operation.as_str(),
        capability
    ));
    let outcome = run_attach_helper(
        config,
        target.pid,
        runtime,
        operation,
        &report_path,
        &capability,
        target_architecture,
    )?;

    let report_contents = fs::read_to_string(&report_path).map_err(|error| {
        if outcome.succeeded {
            InjectorError::JvmAttachReportMissing {
                operation: operation.as_str(),
                path: report_path.clone(),
            }
        } else {
            InjectorError::JvmAttachHelperFailed {
                operation: operation.as_str(),
                detail: format!(
                    "{}; report was not published: {}",
                    outcome.detail,
                    error.kind()
                ),
            }
        }
    })?;
    let report = parse_agent_report(
        &report_contents,
        target.pid,
        operation,
        target_architecture,
        &capability,
    )?;
    if !outcome.succeeded && !is_known_agent_load_completion_quirk(&outcome) {
        return Err(InjectorError::JvmAttachHelperFailed {
            operation: operation.as_str(),
            detail: outcome.detail,
        });
    }
    Ok(report)
}

fn is_known_agent_load_completion_quirk(outcome: &HelperOutcome) -> bool {
    // macOS Temurin 8 can report AgentLoadException with the zero status after
    // Agent_OnAttach has returned successfully. The report has already been
    // parsed above and is capability-bound, PID-bound, operation-bound, and
    // handshake-validated, so it is stronger evidence of the test agent's
    // outcome than this specific helper exit status. Do not generalize this
    // exception to other Attach failures.
    !outcome.succeeded && outcome.detail.contains(JDK8_AGENT_LOAD_COMPLETION_QUIRK)
}

fn run_attach_helper(
    config: &JvmAttachConfig,
    pid: u32,
    runtime: &Path,
    operation: JvmAttachOperation,
    report: &Path,
    capability: &str,
    target_architecture: TargetArchitecture,
) -> Result<HelperOutcome, InjectorError> {
    let mut command = Command::new(&config.java);
    command
        .arg("-cp")
        .arg(&config.classpath)
        .arg(ATTACH_HARNESS_HELPER_MAIN_CLASS)
        .arg("--pid")
        .arg(pid.to_string())
        .arg("--runtime")
        .arg(runtime)
        .arg("--operation")
        .arg(operation.as_str())
        .arg("--report")
        .arg(report)
        .arg("--capability")
        .arg(capability)
        .arg("--target-architecture")
        .arg(target_architecture.to_string())
        .arg("--injector-version")
        .arg(env!("CARGO_PKG_VERSION"))
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let child = command
        .spawn()
        .map_err(|error| InjectorError::JvmAttachHelperLaunchFailed {
            detail: error.to_string(),
        })?;
    wait_for_helper(child, operation)
}

fn wait_for_helper(
    mut child: Child,
    operation: JvmAttachOperation,
) -> Result<HelperOutcome, InjectorError> {
    let deadline = Instant::now() + ATTACH_TIMEOUT;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if Instant::now() < deadline => {
                thread::sleep(Duration::from_millis(20));
            }
            Ok(None) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(InjectorError::JvmAttachTimeout {
                    operation: operation.as_str(),
                });
            }
            Err(error) => {
                return Err(InjectorError::JvmAttachHelperFailed {
                    operation: operation.as_str(),
                    detail: format!("Cannot observe Attach helper: {error}"),
                });
            }
        }
    };

    let stdout = read_child_output(child.stdout.take())?;
    let stderr = read_child_output(child.stderr.take())?;
    let detail = summarize_helper_output(&stdout, &stderr, &status.to_string());
    Ok(HelperOutcome {
        succeeded: status.success(),
        detail,
    })
}

fn read_child_output<T: Read>(stream: Option<T>) -> Result<String, InjectorError> {
    let Some(mut stream) = stream else {
        return Ok(String::new());
    };
    let mut output = String::new();
    stream.read_to_string(&mut output).map_err(|error| {
        InjectorError::JvmAttachHelperLaunchFailed {
            detail: format!("Cannot read Attach helper output: {error}"),
        }
    })?;
    Ok(output)
}

fn summarize_helper_output(stdout: &str, stderr: &str, status: &str) -> String {
    let candidate = if !stderr.trim().is_empty() {
        stderr
    } else if !stdout.trim().is_empty() {
        stdout
    } else {
        status
    };
    let sanitized: String = candidate
        .chars()
        .map(|character| {
            if character.is_control() {
                ' '
            } else {
                character
            }
        })
        .collect();
    let compact = sanitized.split_whitespace().collect::<Vec<_>>().join(" ");
    compact.chars().take(320).collect()
}

fn parse_agent_report(
    contents: &str,
    expected_pid: u32,
    expected_operation: JvmAttachOperation,
    expected_architecture: TargetArchitecture,
    expected_capability: &str,
) -> Result<JvmAttachReport, InjectorError> {
    let fields = parse_report_fields(contents)?;
    let expected_fields = [
        "protocolVersion",
        "injectorVersion",
        "nativeRuntimeVersion",
        "javaRuntimeVersion",
        "targetArchitecture",
        "mappingSchemaVersion",
        "oneConfigAdapterVersion",
        "artifactChecksums",
        "pid",
        "operation",
        "result",
        "state",
        "capability",
    ];
    if fields
        .keys()
        .any(|key| !expected_fields.contains(&key.as_str()) && key != "reason")
        || fields.len() < expected_fields.len()
        || fields.len() > expected_fields.len() + 1
    {
        return Err(InjectorError::JvmAttachReportInvalid {
            operation: expected_operation.as_str(),
            detail: "report fields do not match the M3 JVM Attach contract".to_owned(),
        });
    }

    let protocol_version = required_report_field(&fields, "protocolVersion", expected_operation)?
        .parse::<u32>()
        .map_err(|_| InjectorError::JvmAttachReportInvalid {
            operation: expected_operation.as_str(),
            detail: "report protocolVersion is not an integer".to_owned(),
        })?;
    if protocol_version != PROTOCOL_VERSION {
        return Err(InjectorError::HandshakeProtocolMismatch {
            expected: PROTOCOL_VERSION,
            actual: protocol_version,
        });
    }

    let pid = required_report_field(&fields, "pid", expected_operation)?
        .parse::<u32>()
        .map_err(|_| InjectorError::JvmAttachReportInvalid {
            operation: expected_operation.as_str(),
            detail: "report pid is not an unsigned integer".to_owned(),
        })?;
    if pid != expected_pid {
        return Err(InjectorError::JvmAttachReportInvalid {
            operation: expected_operation.as_str(),
            detail: "report pid does not match the selected target".to_owned(),
        });
    }
    if required_report_field(&fields, "operation", expected_operation)?
        != expected_operation.as_str()
    {
        return Err(InjectorError::JvmAttachReportInvalid {
            operation: expected_operation.as_str(),
            detail: "report operation does not match the requested operation".to_owned(),
        });
    }
    if required_report_field(&fields, "capability", expected_operation)? != expected_capability {
        return Err(InjectorError::JvmAttachReportInvalid {
            operation: expected_operation.as_str(),
            detail: "report capability does not match the request".to_owned(),
        });
    }

    let target_architecture = TargetArchitecture::parse(required_report_field(
        &fields,
        "targetArchitecture",
        expected_operation,
    )?)?;
    if target_architecture != expected_architecture {
        return Err(InjectorError::HandshakeArchitectureMismatch {
            expected: expected_architecture,
            actual: target_architecture,
        });
    }

    let handshake = VersionHandshake {
        protocol_version,
        injector_version: required_report_field(&fields, "injectorVersion", expected_operation)?
            .to_owned(),
        native_runtime_version: required_report_field(
            &fields,
            "nativeRuntimeVersion",
            expected_operation,
        )?
        .to_owned(),
        java_runtime_version: required_report_field(
            &fields,
            "javaRuntimeVersion",
            expected_operation,
        )?
        .to_owned(),
        target_architecture,
        mapping_schema_version: required_report_field(
            &fields,
            "mappingSchemaVersion",
            expected_operation,
        )?
        .to_owned(),
        oneconfig_adapter_version: required_report_field(
            &fields,
            "oneConfigAdapterVersion",
            expected_operation,
        )?
        .to_owned(),
        artifact_checksums: required_report_field(
            &fields,
            "artifactChecksums",
            expected_operation,
        )?
        .to_owned(),
    };
    validate_foundation_handshake(&handshake, expected_architecture)?;

    let result = required_report_field(&fields, "result", expected_operation)?;
    let state = required_report_field(&fields, "state", expected_operation)?;
    if result == "error" {
        let reason = fields
            .get("reason")
            .map(String::as_str)
            .unwrap_or("agent_reported_error");
        return Err(InjectorError::JvmAttachAgentRejected {
            operation: expected_operation.as_str(),
            detail: reason.to_owned(),
        });
    }
    let (expected_result, expected_state) = match expected_operation {
        JvmAttachOperation::Load => ("ready", "running"),
        JvmAttachOperation::Unload => ("stopped", "stopped"),
    };
    if result != expected_result || state != expected_state {
        return Err(InjectorError::JvmAttachReportInvalid {
            operation: expected_operation.as_str(),
            detail: "report result or lifecycle state is invalid".to_owned(),
        });
    }

    Ok(JvmAttachReport {
        pid,
        operation: expected_operation,
        target_architecture,
        state: state.to_owned(),
    })
}

fn parse_report_fields(contents: &str) -> Result<BTreeMap<String, String>, InjectorError> {
    let mut fields = BTreeMap::new();
    for line in contents.lines() {
        let Some((key, value)) = line.split_once('=') else {
            return Err(InjectorError::JvmAttachReportInvalid {
                operation: "unknown",
                detail: "report contains a malformed field".to_owned(),
            });
        };
        if key.is_empty()
            || value.is_empty()
            || key
                .chars()
                .any(|character| !character.is_ascii_alphanumeric())
            || fields.insert(key.to_owned(), value.to_owned()).is_some()
        {
            return Err(InjectorError::JvmAttachReportInvalid {
                operation: "unknown",
                detail: "report contains an invalid or duplicate field".to_owned(),
            });
        }
    }
    Ok(fields)
}

fn required_report_field<'a>(
    fields: &'a BTreeMap<String, String>,
    name: &'static str,
    operation: JvmAttachOperation,
) -> Result<&'a str, InjectorError> {
    fields
        .get(name)
        .map(String::as_str)
        .ok_or_else(|| InjectorError::JvmAttachReportInvalid {
            operation: operation.as_str(),
            detail: format!("report is missing {name}"),
        })
}

fn session_directory(owner_uid: u32) -> PathBuf {
    env::temp_dir()
        .join("opus-injector-m3")
        .join(owner_uid.to_string())
}

fn session_path(owner_uid: u32, pid: u32) -> PathBuf {
    session_directory(owner_uid).join(format!("{pid}.session"))
}

fn ensure_private_session_directory(owner_uid: u32) -> Result<PathBuf, InjectorError> {
    let root = env::temp_dir().join("opus-injector-m3");
    let directory = session_directory(owner_uid);
    for path in [&root, &directory] {
        if !path.exists() {
            let mut builder = fs::DirBuilder::new();
            builder.recursive(true);
            #[cfg(unix)]
            builder.mode(0o700);
            builder
                .create(path)
                .map_err(|error| InjectorError::JvmAttachSessionStorageFailed {
                    detail: format!("Cannot create private session directory: {error}"),
                })?;
        }
        let metadata =
            path.metadata()
                .map_err(|error| InjectorError::JvmAttachSessionStorageFailed {
                    detail: format!("Cannot inspect private session directory: {error}"),
                })?;
        if !metadata.is_dir() {
            return Err(InjectorError::JvmAttachSessionStorageFailed {
                detail: "private session path is not a directory".to_owned(),
            });
        }
        #[cfg(unix)]
        {
            if metadata.uid() != owner_uid {
                return Err(InjectorError::JvmAttachSessionStorageFailed {
                    detail: "private session directory is not owned by the current user".to_owned(),
                });
            }
            fs::set_permissions(path, fs::Permissions::from_mode(0o700)).map_err(|error| {
                InjectorError::JvmAttachSessionStorageFailed {
                    detail: format!("Cannot secure private session directory: {error}"),
                }
            })?;
        }
    }
    Ok(directory)
}

fn read_session_if_present(
    pid: u32,
    owner_uid: u32,
) -> Result<Option<JvmAttachSession>, InjectorError> {
    let path = session_path(owner_uid, pid);
    if !path.exists() {
        return Ok(None);
    }
    #[cfg(unix)]
    {
        let metadata = path
            .metadata()
            .map_err(|error| InjectorError::JvmAttachSessionInvalid {
                pid,
                detail: format!("Cannot inspect session: {error}"),
            })?;
        if !metadata.is_file() || metadata.uid() != owner_uid || metadata.mode() & 0o077 != 0 {
            return Err(InjectorError::JvmAttachSessionInvalid {
                pid,
                detail: "session file must be a private current-user regular file".to_owned(),
            });
        }
    }
    let contents =
        fs::read_to_string(&path).map_err(|error| InjectorError::JvmAttachSessionInvalid {
            pid,
            detail: format!("Cannot read session: {error}"),
        })?;
    parse_session(&contents, pid, owner_uid).map(Some)
}

fn write_session(session: &JvmAttachSession) -> Result<(), InjectorError> {
    let directory = ensure_private_session_directory(session.owner_uid)?;
    let path = session_path(session.owner_uid, session.pid);
    let capability = random_capability()?;
    let temporary_path = directory.join(format!(".{}.{}.tmp", session.pid, capability));
    let contents = render_session(session);
    #[cfg(unix)]
    let mut output = OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(&temporary_path)
        .map_err(|error| InjectorError::JvmAttachSessionStorageFailed {
            detail: format!("Cannot create session file: {error}"),
        })?;
    #[cfg(not(unix))]
    let mut output = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary_path)
        .map_err(|error| InjectorError::JvmAttachSessionStorageFailed {
            detail: format!("Cannot create session file: {error}"),
        })?;
    output
        .write_all(contents.as_bytes())
        .and_then(|()| output.sync_all())
        .map_err(|error| InjectorError::JvmAttachSessionStorageFailed {
            detail: format!("Cannot write session file: {error}"),
        })?;
    fs::rename(&temporary_path, &path).map_err(|error| {
        InjectorError::JvmAttachSessionStorageFailed {
            detail: format!("Cannot publish session file: {error}"),
        }
    })?;
    #[cfg(unix)]
    fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).map_err(|error| {
        InjectorError::JvmAttachSessionStorageFailed {
            detail: format!("Cannot secure session file: {error}"),
        }
    })?;
    Ok(())
}

fn render_session(session: &JvmAttachSession) -> String {
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
        session.state.as_str(),
    )
}

fn parse_session(
    contents: &str,
    expected_pid: u32,
    expected_owner_uid: u32,
) -> Result<JvmAttachSession, InjectorError> {
    let fields = parse_session_fields(contents, expected_pid)?;
    const REQUIRED: [&str; 9] = [
        "schemaVersion",
        "pid",
        "ownerUid",
        "targetExecutable",
        "processStartTime",
        "commandFingerprint",
        "targetArchitecture",
        "runtime",
        "state",
    ];
    if fields.len() != REQUIRED.len() || fields.keys().any(|key| !REQUIRED.contains(&key.as_str()))
    {
        return Err(InjectorError::JvmAttachSessionInvalid {
            pid: expected_pid,
            detail: "session fields do not match the M3 JVM Attach contract".to_owned(),
        });
    }
    let schema = parse_session_u32(&fields, "schemaVersion", expected_pid)?;
    if schema != SESSION_SCHEMA_VERSION {
        return Err(InjectorError::JvmAttachSessionInvalid {
            pid: expected_pid,
            detail: "session schema version is unsupported".to_owned(),
        });
    }
    let pid = parse_session_u32(&fields, "pid", expected_pid)?;
    if pid != expected_pid {
        return Err(InjectorError::JvmAttachSessionInvalid {
            pid: expected_pid,
            detail: "session pid does not match the selected target".to_owned(),
        });
    }
    let owner_uid = parse_session_u32(&fields, "ownerUid", expected_pid)?;
    if owner_uid != expected_owner_uid {
        return Err(InjectorError::JvmAttachSessionInvalid {
            pid: expected_pid,
            detail: "session owner does not match the current user".to_owned(),
        });
    }
    let executable = percent_decode(required_session_field(
        &fields,
        "targetExecutable",
        expected_pid,
    )?)
    .ok_or_else(|| InjectorError::JvmAttachSessionInvalid {
        pid: expected_pid,
        detail: "session target executable is not valid percent-encoded UTF-8".to_owned(),
    })?;
    let started_at = percent_decode(required_session_field(
        &fields,
        "processStartTime",
        expected_pid,
    )?)
    .filter(|value| !value.trim().is_empty())
    .ok_or_else(|| InjectorError::JvmAttachSessionInvalid {
        pid: expected_pid,
        detail: "session process start time is not valid percent-encoded UTF-8".to_owned(),
    })?;
    let command_fingerprint =
        required_session_field(&fields, "commandFingerprint", expected_pid)?.to_owned();
    if command_fingerprint.len() != 16
        || command_fingerprint
            .chars()
            .any(|character| !character.is_ascii_hexdigit() || character.is_ascii_uppercase())
    {
        return Err(InjectorError::JvmAttachSessionInvalid {
            pid: expected_pid,
            detail: "session command fingerprint is invalid".to_owned(),
        });
    }
    let runtime = PathBuf::from(
        percent_decode(required_session_field(&fields, "runtime", expected_pid)?).ok_or_else(
            || InjectorError::JvmAttachSessionInvalid {
                pid: expected_pid,
                detail: "session runtime path is not valid percent-encoded UTF-8".to_owned(),
            },
        )?,
    );
    let target_architecture = TargetArchitecture::parse(required_session_field(
        &fields,
        "targetArchitecture",
        expected_pid,
    )?)?;
    let state = SessionState::parse(required_session_field(&fields, "state", expected_pid)?)
        .ok_or_else(|| InjectorError::JvmAttachSessionInvalid {
            pid: expected_pid,
            detail: "session state is invalid".to_owned(),
        })?;
    Ok(JvmAttachSession {
        pid,
        owner_uid,
        executable,
        process_identity: ProcessInstanceIdentity {
            started_at,
            command_fingerprint,
        },
        target_architecture,
        runtime,
        state,
    })
}

fn parse_session_fields(
    contents: &str,
    pid: u32,
) -> Result<BTreeMap<String, String>, InjectorError> {
    let mut fields = BTreeMap::new();
    for line in contents.lines() {
        let Some((key, value)) = line.split_once('=') else {
            return Err(InjectorError::JvmAttachSessionInvalid {
                pid,
                detail: "session contains a malformed field".to_owned(),
            });
        };
        if key.is_empty()
            || value.is_empty()
            || key
                .chars()
                .any(|character| !character.is_ascii_alphanumeric())
            || fields.insert(key.to_owned(), value.to_owned()).is_some()
        {
            return Err(InjectorError::JvmAttachSessionInvalid {
                pid,
                detail: "session contains an invalid or duplicate field".to_owned(),
            });
        }
    }
    Ok(fields)
}

fn required_session_field<'a>(
    fields: &'a BTreeMap<String, String>,
    name: &'static str,
    pid: u32,
) -> Result<&'a str, InjectorError> {
    fields
        .get(name)
        .map(String::as_str)
        .ok_or_else(|| InjectorError::JvmAttachSessionInvalid {
            pid,
            detail: format!("session is missing {name}"),
        })
}

fn parse_session_u32(
    fields: &BTreeMap<String, String>,
    name: &'static str,
    pid: u32,
) -> Result<u32, InjectorError> {
    required_session_field(fields, name, pid)?
        .parse::<u32>()
        .map_err(|_| InjectorError::JvmAttachSessionInvalid {
            pid,
            detail: format!("session {name} is not an unsigned integer"),
        })
}

fn validate_session_target(
    session: &JvmAttachSession,
    target: &ProcessSnapshot,
) -> Result<(), InjectorError> {
    let process_identity = target_instance_identity(target)?;
    if session.pid != target.pid
        || session.owner_uid != current_owner_uid(target)?
        || session.executable != target.executable
        || session.process_identity != process_identity
    {
        return Err(InjectorError::JvmAttachSessionMismatch {
            pid: target.pid,
            detail: "stored session does not match the explicit Attach-harness process instance"
                .to_owned(),
        });
    }
    Ok(())
}

fn random_capability() -> Result<String, InjectorError> {
    let mut bytes = [0u8; CAPABILITY_BYTES];
    File::open("/dev/urandom")
        .and_then(|mut source| source.read_exact(&mut bytes))
        .map_err(|error| InjectorError::JvmAttachSessionStorageFailed {
            detail: format!("Cannot generate an M3 Attach capability: {error}"),
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
        HelperOutcome, JvmAttachOperation, SessionState, is_known_agent_load_completion_quirk,
        parse_agent_report, parse_session, percent_decode, percent_encode, render_session,
    };
    use crate::architecture::TargetArchitecture;

    fn report(operation: &str, result: &str, state: &str) -> String {
        format!(
            concat!(
                "protocolVersion=1\n",
                "injectorVersion=0.1.0\n",
                "nativeRuntimeVersion=0.1.0\n",
                "javaRuntimeVersion=not-built\n",
                "targetArchitecture=arm64\n",
                "mappingSchemaVersion=not-applicable\n",
                "oneConfigAdapterVersion=not-loaded\n",
                "artifactChecksums=not-packaged\n",
                "pid=42\n",
                "operation={operation}\n",
                "result={result}\n",
                "state={state}\n",
                "capability=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n"
            ),
            operation = operation,
            result = result,
            state = state,
        )
    }

    #[test]
    fn parses_a_complete_load_agent_report() {
        let parsed = parse_agent_report(
            &report("load", "ready", "running"),
            42,
            JvmAttachOperation::Load,
            TargetArchitecture::Arm64,
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        )
        .expect("complete agent load report should parse");
        assert_eq!(parsed.state, "running");
    }

    #[test]
    fn rejects_an_agent_report_with_the_wrong_capability() {
        let error = parse_agent_report(
            &report("load", "ready", "running"),
            42,
            JvmAttachOperation::Load,
            TargetArchitecture::Arm64,
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        )
        .expect_err("capability mismatch must fail");
        assert_eq!(error.code(), "JvmAttachReportInvalid");
    }

    #[test]
    fn recognizes_only_the_known_java_8_agent_load_completion_quirk() {
        assert!(is_known_agent_load_completion_quirk(&HelperOutcome {
            succeeded: false,
            detail: "OPUS_ATTACH_HARNESS_ERROR AgentLoadException:Failed to load agent library: 0"
                .to_owned(),
        }));
        assert!(!is_known_agent_load_completion_quirk(&HelperOutcome {
            succeeded: false,
            detail: "OPUS_ATTACH_HARNESS_ERROR AgentLoadException:Failed to load agent library: 1"
                .to_owned(),
        }));
        assert!(!is_known_agent_load_completion_quirk(&HelperOutcome {
            succeeded: true,
            detail: "OPUS_ATTACH_HARNESS operation=load result=ok".to_owned(),
        }));
    }

    #[test]
    fn percent_encoding_round_trips_utf8_paths() {
        let original = "/tmp/Opus Runtime/đường.dylib";
        assert_eq!(
            percent_decode(&percent_encode(original)).as_deref(),
            Some(original)
        );
    }

    #[test]
    fn session_round_trip_preserves_stopped_state() {
        let session = super::JvmAttachSession {
            pid: 42,
            owner_uid: 501,
            executable: "/usr/bin/java".to_owned(),
            process_identity: crate::process::ProcessInstanceIdentity {
                started_at: "Wed Sep 10 12:00:00 2026".to_owned(),
                command_fingerprint: "0123456789abcdef".to_owned(),
            },
            target_architecture: TargetArchitecture::Arm64,
            runtime: "/tmp/libopus-runtime.dylib".into(),
            state: SessionState::Stopped,
        };
        let parsed = parse_session(&render_session(&session), 42, 501)
            .expect("rendered session should parse");
        assert_eq!(parsed, session);
    }
}
