use crate::architecture::{
    TargetArchitecture, format_architectures, inspect_runtime_architectures,
    validate_runtime_architecture,
};
use crate::diagnostics::{InjectorError, InjectorPhase};
use crate::process::{
    ProcessSnapshot, current_user_id, find_process, inspect_system_processes,
    require_current_user_ownership,
};
use crate::transport::{PROTOCOL_VERSION, VersionHandshake, validate_foundation_handshake};
use std::collections::BTreeMap;
use std::fs::{canonicalize, read_to_string};
use std::io::{BufRead, BufReader, Write};
use std::net::{Ipv4Addr, SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::time::Duration;

pub const AUTHORIZED_TARGET_KIND: &str = "opus-authorized-test-harness";
pub const OPUS_OWNED_CLIENT_KIND: &str = "opus-owned-client";

const REQUEST_PREFIX: &str = "OPUS_AUTHORIZED_TARGET_REQUEST ";
const RESPONSE_PREFIX: &str = "OPUS_AUTHORIZED_TARGET_RESPONSE ";
const CONNECT_TIMEOUT: Duration = Duration::from_secs(2);
const RESPONSE_TIMEOUT: Duration = Duration::from_secs(5);
const MAX_DESCRIPTOR_BYTES: usize = 4096;
const MAX_RESPONSE_BYTES: usize = 4096;
const MAX_PROTOCOL_FIELDS: usize = 16;
const AUTHORIZED_TARGET_MAIN_CLASS: &str = "dev.opus.runtime.harness.AuthorizedRuntimeTarget";
const OPUS_OWNED_CLIENT_MAIN_CLASS: &str =
    "dev.opus.runtime.ownedclient.OpusOwnedM3ClientBootstrap";
const OPUS_OWNED_CLIENT_CONTROL_PROPERTY: &str = "-Dopus.m3.runtime-control.config=";
const REQUIRED_RESPONSE_FIELDS: &[&str] = &[
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

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CooperativeTargetKind {
    AuthorizedTestHarness,
    OpusOwnedClient,
}

impl CooperativeTargetKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::AuthorizedTestHarness => AUTHORIZED_TARGET_KIND,
            Self::OpusOwnedClient => OPUS_OWNED_CLIENT_KIND,
        }
    }

    fn label(self) -> &'static str {
        match self {
            Self::AuthorizedTestHarness => "authorized test harness",
            Self::OpusOwnedClient => "OPUS-owned client preview",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AuthorizedTargetOperation {
    Load,
    Unload,
    Health,
    Stop,
    CloseGame,
}

impl AuthorizedTargetOperation {
    pub fn parse(value: &str) -> Result<Self, InjectorError> {
        match value {
            "load" => Ok(Self::Load),
            "unload" => Ok(Self::Unload),
            "health" => Ok(Self::Health),
            "stop" => Ok(Self::Stop),
            "close-game" => Ok(Self::CloseGame),
            _ => Err(InjectorError::InvalidArguments {
                message: format!(
                    "cooperative target operation must be load, unload, health, stop, or close-game; got {value:?}"
                ),
            }),
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Load => "load",
            Self::Unload => "unload",
            Self::Health => "health",
            Self::Stop => "stop",
            Self::CloseGame => "close-game",
        }
    }

    pub fn phase(self) -> InjectorPhase {
        match self {
            Self::Unload | Self::Stop | Self::CloseGame => InjectorPhase::UnloadTransport,
            Self::Load | Self::Health => InjectorPhase::LoadTransport,
        }
    }

    fn expected_success_code(self) -> &'static str {
        match self {
            Self::Load => "Ready",
            Self::Unload => "Stopped",
            Self::Health => "TargetAlive",
            Self::Stop => "TargetStopping",
            Self::CloseGame => "GameCloseRequested",
        }
    }

    fn required_state(self) -> Option<&'static str> {
        match self {
            Self::Load => Some("running"),
            Self::Unload | Self::Stop | Self::CloseGame => Some("stopped"),
            Self::Health => None,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuthorizedTargetDescriptor {
    pub path: PathBuf,
    pub target_kind: CooperativeTargetKind,
    pub pid: u32,
    pub port: u16,
    pub target_architecture: TargetArchitecture,
    capability: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuthorizedTargetReport {
    pub operation: AuthorizedTargetOperation,
    pub target_pid: u32,
    pub target_architecture: TargetArchitecture,
    pub state: String,
    pub runtime_architectures: Option<std::collections::BTreeSet<TargetArchitecture>>,
}

impl AuthorizedTargetReport {
    pub fn summary(&self) -> String {
        let runtime_architectures = self
            .runtime_architectures
            .as_ref()
            .map(format_architectures)
            .unwrap_or_else(|| "not-applicable".to_owned());
        format!(
            "target_pid={} target_architecture={} state={} runtime_architectures={}",
            self.target_pid, self.target_architecture, self.state, runtime_architectures
        )
    }
}

pub fn request_authorized_target(
    descriptor_path: &Path,
    operation: AuthorizedTargetOperation,
    runtime: Option<&Path>,
    expected_state: Option<&str>,
) -> Result<AuthorizedTargetReport, InjectorError> {
    request_cooperative_target(
        descriptor_path,
        CooperativeTargetKind::AuthorizedTestHarness,
        operation,
        runtime,
        expected_state,
    )
}

pub fn request_opus_owned_client(
    descriptor_path: &Path,
    operation: AuthorizedTargetOperation,
    runtime: Option<&Path>,
    expected_state: Option<&str>,
) -> Result<AuthorizedTargetReport, InjectorError> {
    request_cooperative_target(
        descriptor_path,
        CooperativeTargetKind::OpusOwnedClient,
        operation,
        runtime,
        expected_state,
    )
}

fn request_cooperative_target(
    descriptor_path: &Path,
    expected_target_kind: CooperativeTargetKind,
    operation: AuthorizedTargetOperation,
    runtime: Option<&Path>,
    expected_state: Option<&str>,
) -> Result<AuthorizedTargetReport, InjectorError> {
    if operation != AuthorizedTargetOperation::Health && expected_state.is_some() {
        return Err(InjectorError::InvalidArguments {
            message: "--expect-state is only valid for cooperative target health".to_owned(),
        });
    }
    if operation == AuthorizedTargetOperation::CloseGame
        && expected_target_kind != CooperativeTargetKind::OpusOwnedClient
    {
        return Err(InjectorError::InvalidArguments {
            message: "close-game is only available for an explicit OPUS-owned client preview"
                .to_owned(),
        });
    }

    let descriptor = read_descriptor(descriptor_path, expected_target_kind)?;
    validate_selected_process(&descriptor)?;
    let (runtime_path, runtime_architectures) = match operation {
        AuthorizedTargetOperation::Load => {
            let runtime = runtime.ok_or_else(|| InjectorError::InvalidArguments {
                message: "--runtime is required for authorized-target load".to_owned(),
            })?;
            let runtime_path =
                canonicalize(runtime).map_err(|_| InjectorError::RuntimeArtifactMissing {
                    path: runtime.to_path_buf(),
                })?;
            let runtime_architectures = inspect_runtime_architectures(&runtime_path)?;
            validate_runtime_architecture(descriptor.target_architecture, &runtime_architectures)?;
            (Some(runtime_path), Some(runtime_architectures))
        }
        AuthorizedTargetOperation::Unload
        | AuthorizedTargetOperation::Health
        | AuthorizedTargetOperation::Stop
        | AuthorizedTargetOperation::CloseGame => {
            if runtime.is_some() {
                return Err(InjectorError::InvalidArguments {
                    message: format!(
                        "--runtime is only valid for cooperative target load, not {}",
                        operation.as_str()
                    ),
                });
            }
            (None, None)
        }
    };

    let request = render_request(&descriptor, operation, runtime_path.as_deref())?;
    let response = exchange(&descriptor, operation, &request)?;
    validate_response(
        &descriptor,
        operation,
        &response,
        expected_state,
        runtime_architectures,
    )
}

fn validate_selected_process(descriptor: &AuthorizedTargetDescriptor) -> Result<(), InjectorError> {
    let processes = inspect_system_processes()?;
    validate_selected_process_in(&processes, descriptor, current_user_id()?)
}

fn validate_selected_process_in(
    processes: &[ProcessSnapshot],
    descriptor: &AuthorizedTargetDescriptor,
    current_user_id: u32,
) -> Result<(), InjectorError> {
    let process = find_process(processes, descriptor.pid)?;
    require_current_user_ownership(process, current_user_id)?;
    if !is_cooperative_target_process(descriptor.target_kind, &process.command_line) {
        return Err(InjectorError::AuthorizedTargetProcessMismatch {
            pid: descriptor.pid,
        });
    }
    Ok(())
}

fn is_authorized_target_process(command_line: &str) -> bool {
    command_line.contains(AUTHORIZED_TARGET_MAIN_CLASS)
}

fn is_opus_owned_client_process(command_line: &str) -> bool {
    command_line.contains(OPUS_OWNED_CLIENT_MAIN_CLASS)
        && command_line.contains(OPUS_OWNED_CLIENT_CONTROL_PROPERTY)
}

fn is_cooperative_target_process(target_kind: CooperativeTargetKind, command_line: &str) -> bool {
    match target_kind {
        CooperativeTargetKind::AuthorizedTestHarness => is_authorized_target_process(command_line),
        CooperativeTargetKind::OpusOwnedClient => is_opus_owned_client_process(command_line),
    }
}

fn read_descriptor(
    path: &Path,
    expected_target_kind: CooperativeTargetKind,
) -> Result<AuthorizedTargetDescriptor, InjectorError> {
    let canonical_path =
        canonicalize(path).map_err(|error| InjectorError::AuthorizedTargetDescriptorInvalid {
            detail: format!("Cannot resolve descriptor {}: {error}", path.display()),
        })?;
    let metadata = canonical_path.metadata().map_err(|error| {
        InjectorError::AuthorizedTargetDescriptorInvalid {
            detail: format!(
                "Cannot inspect descriptor {}: {error}",
                canonical_path.display()
            ),
        }
    })?;
    if !metadata.is_file() {
        return Err(InjectorError::AuthorizedTargetDescriptorInvalid {
            detail: format!(
                "Descriptor is not a regular file: {}",
                canonical_path.display()
            ),
        });
    }
    if metadata.len() == 0 || metadata.len() > MAX_DESCRIPTOR_BYTES as u64 {
        return Err(InjectorError::AuthorizedTargetDescriptorInvalid {
            detail: format!(
                "Descriptor {} must contain between 1 and {MAX_DESCRIPTOR_BYTES} bytes",
                canonical_path.display()
            ),
        });
    }

    let contents = read_to_string(&canonical_path).map_err(|error| {
        InjectorError::AuthorizedTargetDescriptorInvalid {
            detail: format!(
                "Cannot read descriptor {}: {error}",
                canonical_path.display()
            ),
        }
    })?;
    let values = parse_descriptor_fields(&contents)?;

    let protocol_version = required_field(&values, "protocolVersion", "descriptor")?
        .parse::<u32>()
        .map_err(|_| InjectorError::AuthorizedTargetDescriptorInvalid {
            detail: "descriptor protocolVersion is not a positive integer".to_owned(),
        })?;
    if protocol_version != PROTOCOL_VERSION {
        return Err(InjectorError::HandshakeProtocolMismatch {
            expected: PROTOCOL_VERSION,
            actual: protocol_version,
        });
    }
    if required_field(&values, "targetKind", "descriptor")? != expected_target_kind.as_str() {
        return Err(InjectorError::AuthorizedTargetDescriptorInvalid {
            detail: format!(
                "descriptor does not identify the selected {}",
                expected_target_kind.label()
            ),
        });
    }

    let pid = parse_nonzero_u32(
        required_field(&values, "pid", "descriptor")?,
        "descriptor pid",
    )?;
    let port = parse_nonzero_u16(
        required_field(&values, "port", "descriptor")?,
        "descriptor port",
    )?;
    let target_architecture =
        TargetArchitecture::parse(required_field(&values, "targetArchitecture", "descriptor")?)?;
    let capability = required_field(&values, "capability", "descriptor")?.to_owned();
    if !is_safe_capability(&capability) {
        return Err(InjectorError::AuthorizedTargetDescriptorInvalid {
            detail: "descriptor capability must be 32-128 ASCII URL-safe characters".to_owned(),
        });
    }

    Ok(AuthorizedTargetDescriptor {
        path: canonical_path,
        target_kind: expected_target_kind,
        pid,
        port,
        target_architecture,
        capability,
    })
}

fn parse_descriptor_fields(contents: &str) -> Result<BTreeMap<String, String>, InjectorError> {
    let mut values = BTreeMap::new();
    for line in contents.lines() {
        if line.trim().is_empty() {
            continue;
        }
        let (key, value) = line.split_once('=').ok_or_else(|| {
            InjectorError::AuthorizedTargetDescriptorInvalid {
                detail: format!("Descriptor field is malformed: {line:?}"),
            }
        })?;
        if key.is_empty()
            || value.is_empty()
            || !is_safe_field_key(key)
            || values.insert(key.to_owned(), value.to_owned()).is_some()
        {
            return Err(InjectorError::AuthorizedTargetDescriptorInvalid {
                detail: format!("Descriptor field is invalid: {line:?}"),
            });
        }
    }

    const REQUIRED: &[&str] = &[
        "protocolVersion",
        "targetKind",
        "pid",
        "port",
        "targetArchitecture",
        "capability",
    ];
    if values.len() != REQUIRED.len() || values.keys().any(|key| !REQUIRED.contains(&key.as_str()))
    {
        return Err(InjectorError::AuthorizedTargetDescriptorInvalid {
            detail: "Descriptor fields do not match the authorized-target fixture contract"
                .to_owned(),
        });
    }
    for required in REQUIRED {
        if !values.contains_key(*required) {
            return Err(InjectorError::AuthorizedTargetDescriptorInvalid {
                detail: format!("Descriptor is missing required field: {required}"),
            });
        }
    }
    Ok(values)
}

fn render_request(
    descriptor: &AuthorizedTargetDescriptor,
    operation: AuthorizedTargetOperation,
    runtime: Option<&Path>,
) -> Result<String, InjectorError> {
    let mut fields = vec![
        format!("protocolVersion={PROTOCOL_VERSION}"),
        format!("targetKind={}", descriptor.target_kind.as_str()),
        format!("operation={}", operation.as_str()),
        format!("capability={}", descriptor.capability),
        format!("targetPid={}", descriptor.pid),
        format!("targetArchitecture={}", descriptor.target_architecture),
    ];
    if let Some(runtime) = runtime {
        let runtime =
            runtime
                .to_str()
                .ok_or_else(|| InjectorError::AuthorizedTargetProtocolError {
                    operation: operation.as_str(),
                    detail: "runtime path is not valid UTF-8 for the cooperative target protocol"
                        .to_owned(),
                })?;
        fields.push(format!("runtimePath={}", percent_encode(runtime)));
    }
    Ok(format!("{REQUEST_PREFIX}{}", fields.join(";")))
}

fn exchange(
    descriptor: &AuthorizedTargetDescriptor,
    operation: AuthorizedTargetOperation,
    request: &str,
) -> Result<BTreeMap<String, String>, InjectorError> {
    let address = SocketAddr::from((Ipv4Addr::LOCALHOST, descriptor.port));
    let mut stream = TcpStream::connect_timeout(&address, CONNECT_TIMEOUT).map_err(|error| {
        InjectorError::AuthorizedTargetConnectionFailed {
            operation: operation.as_str(),
            detail: format!(
                "Cannot connect to selected authorized target {} on loopback port {}: {error}",
                descriptor.pid, descriptor.port
            ),
        }
    })?;
    stream
        .set_read_timeout(Some(RESPONSE_TIMEOUT))
        .map_err(|error| InjectorError::AuthorizedTargetConnectionFailed {
            operation: operation.as_str(),
            detail: format!("Cannot configure authorized target read timeout: {error}"),
        })?;
    stream
        .set_write_timeout(Some(RESPONSE_TIMEOUT))
        .map_err(|error| InjectorError::AuthorizedTargetConnectionFailed {
            operation: operation.as_str(),
            detail: format!("Cannot configure authorized target write timeout: {error}"),
        })?;
    stream
        .write_all(request.as_bytes())
        .and_then(|()| stream.write_all(b"\n"))
        .and_then(|()| stream.flush())
        .map_err(|error| InjectorError::AuthorizedTargetConnectionFailed {
            operation: operation.as_str(),
            detail: format!("Cannot send authorized target request: {error}"),
        })?;

    let mut response = String::new();
    BufReader::new(stream)
        .read_line(&mut response)
        .map_err(|error| InjectorError::AuthorizedTargetConnectionFailed {
            operation: operation.as_str(),
            detail: format!("Cannot read authorized target response: {error}"),
        })?;
    if response.is_empty() || response.len() > MAX_RESPONSE_BYTES {
        return Err(InjectorError::AuthorizedTargetProtocolError {
            operation: operation.as_str(),
            detail: format!(
                "Authorized target response must contain between 1 and {MAX_RESPONSE_BYTES} bytes"
            ),
        });
    }
    parse_protocol_fields(
        response.trim_end_matches(['\r', '\n']),
        RESPONSE_PREFIX,
        operation.as_str(),
    )
}

fn validate_response(
    descriptor: &AuthorizedTargetDescriptor,
    operation: AuthorizedTargetOperation,
    values: &BTreeMap<String, String>,
    expected_state: Option<&str>,
    runtime_architectures: Option<std::collections::BTreeSet<TargetArchitecture>>,
) -> Result<AuthorizedTargetReport, InjectorError> {
    validate_response_shape(values, operation.as_str())?;
    let protocol_version = required_field(values, "protocolVersion", operation.as_str())?
        .parse::<u32>()
        .map_err(|_| InjectorError::AuthorizedTargetProtocolError {
            operation: operation.as_str(),
            detail: "response protocolVersion is not an integer".to_owned(),
        })?;
    if protocol_version != PROTOCOL_VERSION {
        return Err(InjectorError::HandshakeProtocolMismatch {
            expected: PROTOCOL_VERSION,
            actual: protocol_version,
        });
    }
    if required_field(values, "targetKind", operation.as_str())? != descriptor.target_kind.as_str()
    {
        return Err(InjectorError::AuthorizedTargetProtocolError {
            operation: operation.as_str(),
            detail: "response targetKind does not match the selected cooperative target".to_owned(),
        });
    }
    if required_field(values, "operation", operation.as_str())? != operation.as_str() {
        return Err(InjectorError::AuthorizedTargetProtocolError {
            operation: operation.as_str(),
            detail: "response operation does not match the request".to_owned(),
        });
    }
    let target_pid = required_field(values, "targetPid", operation.as_str())?
        .parse::<u32>()
        .ok()
        .filter(|value| *value != 0)
        .ok_or_else(|| InjectorError::AuthorizedTargetProtocolError {
            operation: operation.as_str(),
            detail: "response targetPid must be a non-zero unsigned integer".to_owned(),
        })?;
    if target_pid != descriptor.pid {
        return Err(InjectorError::AuthorizedTargetProtocolError {
            operation: operation.as_str(),
            detail: format!(
                "response targetPid {target_pid} does not match selected descriptor pid {}",
                descriptor.pid
            ),
        });
    }
    let target_architecture = TargetArchitecture::parse(required_field(
        values,
        "targetArchitecture",
        operation.as_str(),
    )?)?;
    if target_architecture != descriptor.target_architecture {
        return Err(InjectorError::HandshakeArchitectureMismatch {
            expected: descriptor.target_architecture,
            actual: target_architecture,
        });
    }

    let response_code = required_field(values, "code", operation.as_str())?;
    if response_code != operation.expected_success_code() {
        return Err(InjectorError::AuthorizedTargetRejected {
            operation: operation.as_str(),
            code: response_code.to_owned(),
        });
    }

    let handshake = VersionHandshake {
        protocol_version,
        injector_version: required_field(values, "injectorVersion", operation.as_str())?.to_owned(),
        native_runtime_version: required_field(values, "nativeRuntimeVersion", operation.as_str())?
            .to_owned(),
        java_runtime_version: required_field(values, "javaRuntimeVersion", operation.as_str())?
            .to_owned(),
        target_architecture,
        mapping_schema_version: required_field(values, "mappingSchemaVersion", operation.as_str())?
            .to_owned(),
        oneconfig_adapter_version: required_field(
            values,
            "oneConfigAdapterVersion",
            operation.as_str(),
        )?
        .to_owned(),
        artifact_checksums: required_field(values, "artifactChecksums", operation.as_str())?
            .to_owned(),
    };
    validate_foundation_handshake(&handshake, descriptor.target_architecture)?;

    let state = required_field(values, "state", operation.as_str())?.to_owned();
    if let Some(required_state) = operation.required_state()
        && state != required_state
    {
        return Err(InjectorError::AuthorizedTargetProtocolError {
            operation: operation.as_str(),
            detail: format!("response state {state:?} must be {required_state:?}"),
        });
    }
    if let Some(expected_state) = expected_state
        && state != expected_state
    {
        return Err(InjectorError::AuthorizedTargetProtocolError {
            operation: operation.as_str(),
            detail: format!(
                "response state {state:?} does not match --expect-state {expected_state:?}"
            ),
        });
    }

    Ok(AuthorizedTargetReport {
        operation,
        target_pid,
        target_architecture,
        state,
        runtime_architectures,
    })
}

fn validate_response_shape(
    values: &BTreeMap<String, String>,
    operation: &'static str,
) -> Result<(), InjectorError> {
    if values.len() != REQUIRED_RESPONSE_FIELDS.len()
        || values
            .keys()
            .any(|field| !REQUIRED_RESPONSE_FIELDS.contains(&field.as_str()))
    {
        return Err(InjectorError::AuthorizedTargetProtocolError {
            operation,
            detail: "response fields do not match the cooperative-target contract".to_owned(),
        });
    }
    Ok(())
}

fn parse_protocol_fields(
    line: &str,
    prefix: &str,
    operation: &'static str,
) -> Result<BTreeMap<String, String>, InjectorError> {
    let payload =
        line.strip_prefix(prefix)
            .ok_or_else(|| InjectorError::AuthorizedTargetProtocolError {
                operation,
                detail: "response does not use the authorized-target protocol prefix".to_owned(),
            })?;
    let mut values = BTreeMap::new();
    for field in payload.split(';') {
        let (key, value) =
            field
                .split_once('=')
                .ok_or_else(|| InjectorError::AuthorizedTargetProtocolError {
                    operation,
                    detail: format!("response field is malformed: {field:?}"),
                })?;
        if key.is_empty()
            || value.is_empty()
            || !is_safe_field_key(key)
            || values.insert(key.to_owned(), value.to_owned()).is_some()
        {
            return Err(InjectorError::AuthorizedTargetProtocolError {
                operation,
                detail: format!("response field is invalid: {field:?}"),
            });
        }
        if values.len() > MAX_PROTOCOL_FIELDS {
            return Err(InjectorError::AuthorizedTargetProtocolError {
                operation,
                detail: format!("response exceeds {MAX_PROTOCOL_FIELDS} protocol fields"),
            });
        }
    }
    Ok(values)
}

fn required_field<'a>(
    values: &'a BTreeMap<String, String>,
    field: &str,
    stage: &'static str,
) -> Result<&'a str, InjectorError> {
    values.get(field).map(String::as_str).ok_or_else(|| {
        InjectorError::AuthorizedTargetProtocolError {
            operation: stage,
            detail: format!("response is missing required field: {field}"),
        }
    })
}

fn parse_nonzero_u32(value: &str, label: &str) -> Result<u32, InjectorError> {
    value
        .parse::<u32>()
        .ok()
        .filter(|value| *value != 0)
        .ok_or_else(|| InjectorError::AuthorizedTargetDescriptorInvalid {
            detail: format!("{label} must be a non-zero unsigned integer"),
        })
}

fn parse_nonzero_u16(value: &str, label: &str) -> Result<u16, InjectorError> {
    value
        .parse::<u16>()
        .ok()
        .filter(|value| *value != 0)
        .ok_or_else(|| InjectorError::AuthorizedTargetDescriptorInvalid {
            detail: format!("{label} must be a non-zero unsigned integer"),
        })
}

fn is_safe_capability(value: &str) -> bool {
    (32..=128).contains(&value.len())
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
}

fn is_safe_field_key(value: &str) -> bool {
    !value.is_empty() && value.bytes().all(|byte| byte.is_ascii_alphanumeric())
}

fn percent_encode(value: &str) -> String {
    let mut encoded = String::with_capacity(value.len());
    for byte in value.as_bytes() {
        if byte.is_ascii_alphanumeric() || matches!(*byte, b'-' | b'_' | b'.' | b'~') {
            encoded.push(*byte as char);
        } else {
            encoded.push('%');
            encoded.push(hex_digit(byte >> 4));
            encoded.push(hex_digit(byte & 0x0f));
        }
    }
    encoded
}

fn hex_digit(value: u8) -> char {
    match value {
        0..=9 => (b'0' + value) as char,
        10..=15 => (b'A' + (value - 10)) as char,
        _ => unreachable!("hex digit input must be a nibble"),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        AUTHORIZED_TARGET_KIND, AuthorizedTargetOperation, CooperativeTargetKind,
        is_authorized_target_process, parse_descriptor_fields, parse_protocol_fields,
        percent_encode, validate_response_shape, validate_selected_process_in,
    };
    use crate::process::ProcessSnapshot;

    #[test]
    fn parses_the_authorized_target_operation_vocabulary() {
        assert_eq!(
            AuthorizedTargetOperation::parse("health").expect("health should parse"),
            AuthorizedTargetOperation::Health
        );
        assert_eq!(
            AuthorizedTargetOperation::parse("close-game")
                .expect("OPUS-owned close-game should parse"),
            AuthorizedTargetOperation::CloseGame
        );
        let error =
            AuthorizedTargetOperation::parse("inject").expect_err("unknown operation must fail");
        assert_eq!(error.code(), "InvalidArguments");
    }

    #[test]
    fn rejects_unknown_descriptor_fields() {
        let error = parse_descriptor_fields(&format!(
            "protocolVersion=1\n\
             targetKind={AUTHORIZED_TARGET_KIND}\n\
             pid=42\n\
             port=1234\n\
             targetArchitecture=arm64\n\
             capability=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n\
             unexpected=value\n"
        ))
        .expect_err("unexpected descriptor fields must fail");
        assert_eq!(error.code(), "AuthorizedTargetDescriptorInvalid");
    }

    #[test]
    fn rejects_duplicate_protocol_fields() {
        let error = parse_protocol_fields(
            "OPUS_AUTHORIZED_TARGET_RESPONSE protocolVersion=1;protocolVersion=1",
            "OPUS_AUTHORIZED_TARGET_RESPONSE ",
            "load",
        )
        .expect_err("duplicate protocol fields must fail");
        assert_eq!(error.code(), "AuthorizedTargetProtocolError");
    }

    #[test]
    fn percent_encodes_protocol_delimiters_in_runtime_paths() {
        assert_eq!(
            percent_encode("/tmp/runtime;version=1.dylib"),
            "%2Ftmp%2Fruntime%3Bversion%3D1.dylib"
        );
    }

    #[test]
    fn recognizes_only_the_authorized_test_target_main_class() {
        let target = ProcessSnapshot {
            pid: 42,
            parent_pid: 1,
            owner_uid: Some(501),
            executable: "/usr/bin/java".to_owned(),
            command_line: concat!(
                "/usr/bin/java -cp /tmp/classes ",
                "dev.opus.runtime.harness.AuthorizedRuntimeTarget"
            )
            .to_owned(),
            start_time: None,
        };
        assert!(is_authorized_target_process(&target.command_line));
        assert!(!is_authorized_target_process(
            "/usr/bin/java net.minecraft.client.main.Main"
        ));
    }

    #[test]
    fn rejects_a_selected_pid_that_is_not_the_authorized_fixture() {
        let descriptor = super::AuthorizedTargetDescriptor {
            path: "/tmp/authorized-target.properties".into(),
            target_kind: CooperativeTargetKind::AuthorizedTestHarness,
            pid: 42,
            port: 1234,
            target_architecture: crate::architecture::TargetArchitecture::Arm64,
            capability: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa".to_owned(),
        };
        let processes = [ProcessSnapshot {
            pid: 42,
            parent_pid: 1,
            owner_uid: Some(501),
            executable: "/usr/bin/java".to_owned(),
            command_line: "/usr/bin/java net.minecraft.client.main.Main".to_owned(),
            start_time: None,
        }];

        let error = validate_selected_process_in(&processes, &descriptor, 501)
            .expect_err("an arbitrary Java process must not satisfy fixture selection");
        assert_eq!(error.code(), "AuthorizedTargetProcessMismatch");
    }

    #[test]
    fn rejects_a_cooperative_target_owned_by_another_user() {
        let descriptor = super::AuthorizedTargetDescriptor {
            path: "/tmp/authorized-target.properties".into(),
            target_kind: CooperativeTargetKind::AuthorizedTestHarness,
            pid: 42,
            port: 1234,
            target_architecture: crate::architecture::TargetArchitecture::Arm64,
            capability: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa".to_owned(),
        };
        let processes = [ProcessSnapshot {
            pid: 42,
            parent_pid: 1,
            owner_uid: Some(502),
            executable: "/usr/bin/java".to_owned(),
            command_line: concat!(
                "/usr/bin/java -cp /tmp/classes ",
                "dev.opus.runtime.harness.AuthorizedRuntimeTarget"
            )
            .to_owned(),
            start_time: None,
        }];

        let error = validate_selected_process_in(&processes, &descriptor, 501)
            .expect_err("a target owned by another user must be rejected");
        assert_eq!(error.code(), "TargetOwnershipMismatch");
    }

    #[test]
    fn rejects_response_fields_outside_the_fixture_contract() {
        let values = parse_protocol_fields(
            "OPUS_AUTHORIZED_TARGET_RESPONSE protocolVersion=1;unexpected=value",
            "OPUS_AUTHORIZED_TARGET_RESPONSE ",
            "health",
        )
        .expect("response syntax should parse before contract validation");

        let error = validate_response_shape(&values, "health")
            .expect_err("extra or missing response fields must fail");
        assert_eq!(error.code(), "AuthorizedTargetProtocolError");
    }
}
