use crate::architecture::{TargetArchitecture, format_architectures};
use std::collections::BTreeSet;
use std::error::Error;
use std::fmt::{Display, Formatter};
use std::path::{Path, PathBuf};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum InjectorPhase {
    Discovery,
    TargetSelection,
    ArchitectureValidation,
    LoadTransport,
    UnloadTransport,
}

impl Display for InjectorPhase {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        let value = match self {
            Self::Discovery => "discovery",
            Self::TargetSelection => "target-selection",
            Self::ArchitectureValidation => "architecture-validation",
            Self::LoadTransport => "load-transport",
            Self::UnloadTransport => "unload-transport",
        };
        formatter.write_str(value)
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Diagnostic {
    pub phase: InjectorPhase,
    pub code: &'static str,
    pub message: String,
}

impl Diagnostic {
    pub fn new(phase: InjectorPhase, code: &'static str, message: impl Into<String>) -> Self {
        Self {
            phase,
            code,
            message: message.into(),
        }
    }

    pub fn render(&self) -> String {
        format!(
            "[OPUS/INJECTOR] phase={} code={} message={}",
            self.phase,
            self.code,
            sanitize_for_line(&self.message)
        )
    }
}

pub fn sanitize_for_line(value: &str) -> String {
    value
        .chars()
        .map(|character| {
            if character.is_control() {
                ' '
            } else {
                character
            }
        })
        .collect()
}

#[derive(Debug)]
pub enum InjectorError {
    InvalidArguments {
        message: String,
    },
    ProcessInspectionFailed {
        detail: String,
    },
    ProcessNotFound {
        pid: u32,
    },
    UnsupportedRuntimeCandidate {
        pid: u32,
    },
    TargetOwnershipUnknown {
        pid: u32,
    },
    TargetOwnershipMismatch {
        pid: u32,
    },
    InvalidArchitecture {
        value: String,
    },
    RuntimeArtifactMissing {
        path: PathBuf,
    },
    RuntimeInspectionFailed {
        path: PathBuf,
        detail: String,
    },
    RuntimeArchitectureUnreadable {
        path: PathBuf,
        output: String,
    },
    TargetExecutableMissing {
        path: PathBuf,
    },
    TargetExecutableInspectionFailed {
        path: PathBuf,
        detail: String,
    },
    TargetExecutableArchitectureUnreadable {
        path: PathBuf,
        output: String,
    },
    TargetArchitectureNotSingle {
        executable_architectures: BTreeSet<TargetArchitecture>,
    },
    ArchitectureMismatch {
        target_architecture: TargetArchitecture,
        runtime_architectures: BTreeSet<TargetArchitecture>,
    },
    HandshakeProtocolMismatch {
        expected: u32,
        actual: u32,
    },
    HandshakeArchitectureMismatch {
        expected: TargetArchitecture,
        actual: TargetArchitecture,
    },
    HandshakeVersionMismatch {
        component: &'static str,
        expected: String,
        actual: String,
    },
    HandshakeMissingField {
        field: &'static str,
    },
    OwnedTargetLaunchFailed {
        detail: String,
    },
    OwnedTargetProtocolError {
        stage: &'static str,
        detail: String,
    },
    OwnedTargetTimeout {
        stage: &'static str,
    },
    OwnedTargetExitFailure {
        status: String,
    },
    AuthorizedTargetDescriptorInvalid {
        detail: String,
    },
    AuthorizedTargetProcessMismatch {
        pid: u32,
    },
    AuthorizedTargetConnectionFailed {
        operation: &'static str,
        detail: String,
    },
    AuthorizedTargetProtocolError {
        operation: &'static str,
        detail: String,
    },
    AuthorizedTargetRejected {
        operation: &'static str,
        code: String,
    },
    JvmAttachRuntimeMissing {
        pid: u32,
        path: PathBuf,
    },
    JvmAttachHelperClasspathMissing {
        path: PathBuf,
    },
    JvmAttachHelperLaunchFailed {
        detail: String,
    },
    JvmAttachHelperFailed {
        operation: &'static str,
        detail: String,
    },
    JvmAttachTimeout {
        operation: &'static str,
    },
    JvmAttachReportMissing {
        operation: &'static str,
        path: PathBuf,
    },
    JvmAttachReportInvalid {
        operation: &'static str,
        detail: String,
    },
    JvmAttachAgentRejected {
        operation: &'static str,
        detail: String,
    },
    JvmAttachHarnessTargetMismatch {
        pid: u32,
    },
    LldbDevelopmentHarnessTargetMismatch {
        pid: u32,
    },
    JvmAttachProcessIdentityUnavailable {
        pid: u32,
    },
    JvmAttachSessionMissing {
        pid: u32,
    },
    JvmAttachSessionInvalid {
        pid: u32,
        detail: String,
    },
    JvmAttachSessionMismatch {
        pid: u32,
        detail: String,
    },
    JvmAttachSessionAlreadyRunning {
        pid: u32,
    },
    JvmAttachSessionRecoveryRequired {
        pid: u32,
        state: String,
    },
    JvmAttachSessionNotRunning {
        pid: u32,
    },
    JvmAttachSessionStorageFailed {
        detail: String,
    },
    NativeTransportHelperMissing {
        path: PathBuf,
    },
    NativeTransportHelperFailed {
        operation: &'static str,
        detail: String,
    },
    NativeTransportTaskPortDenied {
        pid: u32,
    },
    NativeTransportRosettaRemoteThreadUnavailable {
        pid: u32,
    },
    NativeTransportTimeout {
        operation: &'static str,
    },
    NativeTransportProcessIdentityUnavailable {
        pid: u32,
    },
    NativeTransportSessionMissing {
        pid: u32,
    },
    NativeTransportSessionInvalid {
        pid: u32,
        detail: String,
    },
    NativeTransportSessionMismatch {
        pid: u32,
        detail: String,
    },
    NativeTransportSessionAlreadyRunning {
        pid: u32,
    },
    NativeTransportSessionRecoveryRequired {
        pid: u32,
        state: String,
    },
    NativeTransportSessionNotRunning {
        pid: u32,
    },
    NativeTransportSessionStorageFailed {
        detail: String,
    },
    NativeTransportDescriptorMissing {
        pid: u32,
        path: PathBuf,
    },
    NativeTransportDescriptorInvalid {
        pid: u32,
        detail: String,
    },
    NativeTransportConnectionFailed {
        operation: &'static str,
        detail: String,
    },
    NativeTransportProtocolError {
        operation: &'static str,
        detail: String,
    },
    NativeTransportRejected {
        operation: &'static str,
        code: String,
    },
}

impl InjectorError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::InvalidArguments { .. } => "InvalidArguments",
            Self::ProcessInspectionFailed { .. } => "ProcessInspectionFailed",
            Self::ProcessNotFound { .. } => "ProcessNotFound",
            Self::UnsupportedRuntimeCandidate { .. } => "UnsupportedRuntime",
            Self::TargetOwnershipUnknown { .. } => "TargetOwnershipUnknown",
            Self::TargetOwnershipMismatch { .. } => "TargetOwnershipMismatch",
            Self::InvalidArchitecture { .. } => "ArchitectureMismatch",
            Self::RuntimeArtifactMissing { .. } => "RuntimeArtifactMissing",
            Self::RuntimeInspectionFailed { .. } => "RuntimeInspectionFailed",
            Self::RuntimeArchitectureUnreadable { .. } => "RuntimeArchitectureUnreadable",
            Self::TargetExecutableMissing { .. } => "TargetExecutableMissing",
            Self::TargetExecutableInspectionFailed { .. } => "TargetExecutableInspectionFailed",
            Self::TargetExecutableArchitectureUnreadable { .. } => {
                "TargetExecutableArchitectureUnreadable"
            }
            Self::TargetArchitectureNotSingle { .. } => "TargetArchitectureNotSingle",
            Self::ArchitectureMismatch { .. } => "ArchitectureMismatch",
            Self::HandshakeProtocolMismatch { .. } => "HandshakeProtocolMismatch",
            Self::HandshakeArchitectureMismatch { .. } => "HandshakeArchitectureMismatch",
            Self::HandshakeVersionMismatch { .. } => "HandshakeVersionMismatch",
            Self::HandshakeMissingField { .. } => "HandshakeMissingField",
            Self::OwnedTargetLaunchFailed { .. } => "OwnedTargetLaunchFailed",
            Self::OwnedTargetProtocolError { .. } => "OwnedTargetProtocolError",
            Self::OwnedTargetTimeout { .. } => "OwnedTargetTimeout",
            Self::OwnedTargetExitFailure { .. } => "OwnedTargetExitFailure",
            Self::AuthorizedTargetDescriptorInvalid { .. } => "AuthorizedTargetDescriptorInvalid",
            Self::AuthorizedTargetProcessMismatch { .. } => "AuthorizedTargetProcessMismatch",
            Self::AuthorizedTargetConnectionFailed { .. } => "AuthorizedTargetConnectionFailed",
            Self::AuthorizedTargetProtocolError { .. } => "AuthorizedTargetProtocolError",
            Self::AuthorizedTargetRejected { .. } => "AuthorizedTargetRejected",
            Self::JvmAttachRuntimeMissing { .. } => "JvmAttachRuntimeMissing",
            Self::JvmAttachHelperClasspathMissing { .. } => "JvmAttachHelperClasspathMissing",
            Self::JvmAttachHelperLaunchFailed { .. } => "JvmAttachHelperLaunchFailed",
            Self::JvmAttachHelperFailed { .. } => "JvmAttachHelperFailed",
            Self::JvmAttachTimeout { .. } => "JvmAttachTimeout",
            Self::JvmAttachReportMissing { .. } => "JvmAttachReportMissing",
            Self::JvmAttachReportInvalid { .. } => "JvmAttachReportInvalid",
            Self::JvmAttachAgentRejected { .. } => "JvmAttachAgentRejected",
            Self::JvmAttachHarnessTargetMismatch { .. } => "JvmAttachHarnessTargetMismatch",
            Self::LldbDevelopmentHarnessTargetMismatch { .. } => {
                "LldbDevelopmentHarnessTargetMismatch"
            }
            Self::JvmAttachProcessIdentityUnavailable { .. } => {
                "JvmAttachProcessIdentityUnavailable"
            }
            Self::JvmAttachSessionMissing { .. } => "JvmAttachSessionMissing",
            Self::JvmAttachSessionInvalid { .. } => "JvmAttachSessionInvalid",
            Self::JvmAttachSessionMismatch { .. } => "JvmAttachSessionMismatch",
            Self::JvmAttachSessionAlreadyRunning { .. } => "JvmAttachSessionAlreadyRunning",
            Self::JvmAttachSessionRecoveryRequired { .. } => "JvmAttachSessionRecoveryRequired",
            Self::JvmAttachSessionNotRunning { .. } => "JvmAttachSessionNotRunning",
            Self::JvmAttachSessionStorageFailed { .. } => "JvmAttachSessionStorageFailed",
            Self::NativeTransportHelperMissing { .. } => "NativeTransportHelperMissing",
            Self::NativeTransportHelperFailed { .. } => "NativeTransportHelperFailed",
            Self::NativeTransportTaskPortDenied { .. } => "TaskPortDenied",
            Self::NativeTransportRosettaRemoteThreadUnavailable { .. } => {
                "RosettaRemoteThreadUnavailable"
            }
            Self::NativeTransportTimeout { .. } => "NativeTransportTimeout",
            Self::NativeTransportProcessIdentityUnavailable { .. } => {
                "NativeTransportProcessIdentityUnavailable"
            }
            Self::NativeTransportSessionMissing { .. } => "NativeTransportSessionMissing",
            Self::NativeTransportSessionInvalid { .. } => "NativeTransportSessionInvalid",
            Self::NativeTransportSessionMismatch { .. } => "NativeTransportSessionMismatch",
            Self::NativeTransportSessionAlreadyRunning { .. } => {
                "NativeTransportSessionAlreadyRunning"
            }
            Self::NativeTransportSessionRecoveryRequired { .. } => {
                "NativeTransportSessionRecoveryRequired"
            }
            Self::NativeTransportSessionNotRunning { .. } => "NativeTransportSessionNotRunning",
            Self::NativeTransportSessionStorageFailed { .. } => {
                "NativeTransportSessionStorageFailed"
            }
            Self::NativeTransportDescriptorMissing { .. } => "NativeTransportDescriptorMissing",
            Self::NativeTransportDescriptorInvalid { .. } => "NativeTransportDescriptorInvalid",
            Self::NativeTransportConnectionFailed { .. } => "NativeTransportConnectionFailed",
            Self::NativeTransportProtocolError { .. } => "NativeTransportProtocolError",
            Self::NativeTransportRejected { .. } => "NativeTransportRejected",
        }
    }

    pub fn phase(&self) -> InjectorPhase {
        match self {
            Self::InvalidArguments { .. }
            | Self::ProcessInspectionFailed { .. }
            | Self::ProcessNotFound { .. } => InjectorPhase::Discovery,
            Self::UnsupportedRuntimeCandidate { .. }
            | Self::JvmAttachHarnessTargetMismatch { .. }
            | Self::LldbDevelopmentHarnessTargetMismatch { .. }
            | Self::TargetOwnershipUnknown { .. }
            | Self::TargetOwnershipMismatch { .. } => InjectorPhase::TargetSelection,
            Self::InvalidArchitecture { .. }
            | Self::RuntimeArtifactMissing { .. }
            | Self::RuntimeInspectionFailed { .. }
            | Self::RuntimeArchitectureUnreadable { .. }
            | Self::TargetExecutableMissing { .. }
            | Self::TargetExecutableInspectionFailed { .. }
            | Self::TargetExecutableArchitectureUnreadable { .. }
            | Self::TargetArchitectureNotSingle { .. }
            | Self::ArchitectureMismatch { .. } => InjectorPhase::ArchitectureValidation,
            Self::AuthorizedTargetDescriptorInvalid { .. } => InjectorPhase::TargetSelection,
            Self::AuthorizedTargetProcessMismatch { .. } => InjectorPhase::TargetSelection,
            Self::HandshakeProtocolMismatch { .. }
            | Self::HandshakeArchitectureMismatch { .. }
            | Self::HandshakeVersionMismatch { .. }
            | Self::HandshakeMissingField { .. }
            | Self::OwnedTargetLaunchFailed { .. } => InjectorPhase::LoadTransport,
            Self::OwnedTargetProtocolError { stage, .. } | Self::OwnedTargetTimeout { stage }
                if *stage == "unload" || *stage == "exit" =>
            {
                InjectorPhase::UnloadTransport
            }
            Self::OwnedTargetProtocolError { .. } | Self::OwnedTargetTimeout { .. } => {
                InjectorPhase::LoadTransport
            }
            Self::OwnedTargetExitFailure { .. } => InjectorPhase::UnloadTransport,
            Self::AuthorizedTargetConnectionFailed { operation, .. }
            | Self::AuthorizedTargetProtocolError { operation, .. }
            | Self::AuthorizedTargetRejected { operation, .. }
                if *operation == "unload" || *operation == "stop" =>
            {
                InjectorPhase::UnloadTransport
            }
            Self::AuthorizedTargetConnectionFailed { .. }
            | Self::AuthorizedTargetProtocolError { .. }
            | Self::AuthorizedTargetRejected { .. } => InjectorPhase::LoadTransport,
            Self::JvmAttachRuntimeMissing { .. }
            | Self::JvmAttachHelperClasspathMissing { .. }
            | Self::JvmAttachHelperLaunchFailed { .. }
            | Self::JvmAttachProcessIdentityUnavailable { .. }
            | Self::JvmAttachSessionStorageFailed { .. }
            | Self::JvmAttachSessionAlreadyRunning { .. } => InjectorPhase::LoadTransport,
            Self::JvmAttachHelperFailed { operation, .. }
            | Self::JvmAttachTimeout { operation }
            | Self::JvmAttachReportMissing { operation, .. }
            | Self::JvmAttachReportInvalid { operation, .. }
            | Self::JvmAttachAgentRejected { operation, .. }
                if *operation == "unload" =>
            {
                InjectorPhase::UnloadTransport
            }
            Self::JvmAttachHelperFailed { .. }
            | Self::JvmAttachTimeout { .. }
            | Self::JvmAttachReportMissing { .. }
            | Self::JvmAttachReportInvalid { .. }
            | Self::JvmAttachAgentRejected { .. } => InjectorPhase::LoadTransport,
            Self::JvmAttachSessionMissing { .. }
            | Self::JvmAttachSessionInvalid { .. }
            | Self::JvmAttachSessionMismatch { .. }
            | Self::JvmAttachSessionRecoveryRequired { .. }
            | Self::JvmAttachSessionNotRunning { .. } => InjectorPhase::UnloadTransport,
            Self::NativeTransportProcessIdentityUnavailable { .. }
            | Self::NativeTransportHelperMissing { .. }
            | Self::NativeTransportSessionStorageFailed { .. }
            | Self::NativeTransportSessionAlreadyRunning { .. } => InjectorPhase::LoadTransport,
            Self::NativeTransportTaskPortDenied { .. }
            | Self::NativeTransportRosettaRemoteThreadUnavailable { .. } => {
                InjectorPhase::LoadTransport
            }
            Self::NativeTransportHelperFailed { operation, .. }
            | Self::NativeTransportTimeout { operation }
            | Self::NativeTransportConnectionFailed { operation, .. }
            | Self::NativeTransportProtocolError { operation, .. }
            | Self::NativeTransportRejected { operation, .. }
                if *operation == "unload" || *operation == "stop" =>
            {
                InjectorPhase::UnloadTransport
            }
            Self::NativeTransportHelperFailed { .. }
            | Self::NativeTransportTimeout { .. }
            | Self::NativeTransportConnectionFailed { .. }
            | Self::NativeTransportProtocolError { .. }
            | Self::NativeTransportRejected { .. }
            | Self::NativeTransportDescriptorMissing { .. } => InjectorPhase::LoadTransport,
            Self::NativeTransportSessionMissing { .. }
            | Self::NativeTransportSessionInvalid { .. }
            | Self::NativeTransportSessionMismatch { .. }
            | Self::NativeTransportSessionRecoveryRequired { .. }
            | Self::NativeTransportSessionNotRunning { .. }
            | Self::NativeTransportDescriptorInvalid { .. } => InjectorPhase::UnloadTransport,
        }
    }
}

impl Display for InjectorError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidArguments { message } => formatter.write_str(message),
            Self::ProcessInspectionFailed { detail } => {
                write!(formatter, "Unable to inspect processes: {detail}")
            }
            Self::ProcessNotFound { pid } => write!(formatter, "No process exists with pid {pid}"),
            Self::UnsupportedRuntimeCandidate { pid } => write!(
                formatter,
                "Process {pid} is not an eligible Java Minecraft JVM candidate"
            ),
            Self::TargetOwnershipUnknown { pid } => write!(
                formatter,
                "Cannot verify that selected process {pid} belongs to the current user"
            ),
            Self::TargetOwnershipMismatch { pid } => write!(
                formatter,
                "Selected process {pid} does not belong to the current user"
            ),
            Self::InvalidArchitecture { value } => write!(
                formatter,
                "Unsupported target architecture {value:?}; expected arm64 or x86_64"
            ),
            Self::RuntimeArtifactMissing { path } => {
                write!(
                    formatter,
                    "Native runtime artifact is missing: {}",
                    path.display()
                )
            }
            Self::RuntimeInspectionFailed { path, detail } => write!(
                formatter,
                "Unable to inspect native runtime {}: {detail}",
                path.display()
            ),
            Self::RuntimeArchitectureUnreadable { path, output } => write!(
                formatter,
                "No supported Mach-O architecture was reported for {}: {output}",
                path.display()
            ),
            Self::TargetExecutableMissing { path } => {
                write!(
                    formatter,
                    "Selected Java executable is missing: {}",
                    executable_label(path)
                )
            }
            Self::TargetExecutableInspectionFailed { path, detail } => write!(
                formatter,
                "Unable to inspect selected Java executable {}: {detail}",
                executable_label(path)
            ),
            Self::TargetExecutableArchitectureUnreadable { path, output } => write!(
                formatter,
                "No supported Mach-O architecture was reported for selected Java executable {}: {output}",
                executable_label(path)
            ),
            Self::TargetArchitectureNotSingle {
                executable_architectures,
            } => write!(
                formatter,
                "Automatic target architecture selection requires exactly one Java executable Mach-O slice; observed [{}]. Use prepare with --target-architecture reported by the target JVM os.arch",
                format_architectures(executable_architectures)
            ),
            Self::ArchitectureMismatch {
                target_architecture,
                runtime_architectures,
            } => write!(
                formatter,
                "Target JVM architecture {target_architecture} does not match native runtime slices [{}]",
                format_architectures(runtime_architectures)
            ),
            Self::HandshakeProtocolMismatch { expected, actual } => write!(
                formatter,
                "Runtime handshake protocol {actual} does not match injector protocol {expected}"
            ),
            Self::HandshakeArchitectureMismatch { expected, actual } => write!(
                formatter,
                "Runtime handshake architecture {actual} does not match selected target architecture {expected}"
            ),
            Self::HandshakeVersionMismatch {
                component,
                expected,
                actual,
            } => write!(
                formatter,
                "Runtime handshake {component} version {actual} does not match expected {expected}"
            ),
            Self::HandshakeMissingField { field } => {
                write!(
                    formatter,
                    "Runtime handshake is missing required field {field}"
                )
            }
            Self::OwnedTargetLaunchFailed { detail } => {
                write!(formatter, "Unable to launch the owned JVM target: {detail}")
            }
            Self::OwnedTargetProtocolError { stage, detail } => {
                write!(
                    formatter,
                    "Owned JVM target {stage} protocol failed: {detail}"
                )
            }
            Self::OwnedTargetTimeout { stage } => {
                write!(formatter, "Owned JVM target timed out during {stage}")
            }
            Self::OwnedTargetExitFailure { status } => {
                write!(
                    formatter,
                    "Owned JVM target exited unsuccessfully: {status}"
                )
            }
            Self::AuthorizedTargetDescriptorInvalid { detail } => {
                write!(
                    formatter,
                    "Authorized-target descriptor is invalid: {detail}"
                )
            }
            Self::AuthorizedTargetProcessMismatch { pid } => {
                write!(
                    formatter,
                    "Selected process {pid} is not the requested source-controlled cooperative target"
                )
            }
            Self::AuthorizedTargetConnectionFailed { operation, detail } => {
                write!(
                    formatter,
                    "Cooperative target {operation} request could not connect: {detail}"
                )
            }
            Self::AuthorizedTargetProtocolError { operation, detail } => {
                write!(
                    formatter,
                    "Cooperative target {operation} protocol failed: {detail}"
                )
            }
            Self::AuthorizedTargetRejected { operation, code } => {
                write!(
                    formatter,
                    "Cooperative target rejected the {operation} request with code {code}"
                )
            }
            Self::JvmAttachRuntimeMissing { pid, path } => write!(
                formatter,
                "Selected JVM Attach target {pid} has no readable native runtime at {}",
                path.display()
            ),
            Self::JvmAttachHelperClasspathMissing { path } => write!(
                formatter,
                "JVM Attach helper classpath is missing: {}",
                path.display()
            ),
            Self::JvmAttachHelperLaunchFailed { detail } => {
                write!(
                    formatter,
                    "Unable to launch the JVM Attach helper: {detail}"
                )
            }
            Self::JvmAttachHelperFailed { operation, detail } => write!(
                formatter,
                "JVM Attach helper failed during {operation}: {detail}"
            ),
            Self::JvmAttachTimeout { operation } => {
                write!(formatter, "JVM Attach helper timed out during {operation}")
            }
            Self::JvmAttachReportMissing { operation, path } => write!(
                formatter,
                "JVM Attach {operation} did not publish its runtime report at {}",
                path.display()
            ),
            Self::JvmAttachReportInvalid { operation, detail } => write!(
                formatter,
                "JVM Attach {operation} report is invalid: {detail}"
            ),
            Self::JvmAttachAgentRejected { operation, detail } => write!(
                formatter,
                "Native runtime rejected the JVM Attach {operation} request: {detail}"
            ),
            Self::JvmAttachHarnessTargetMismatch { pid } => write!(
                formatter,
                "Selected process {pid} is not the source-controlled OPUS JVM Attach harness"
            ),
            Self::LldbDevelopmentHarnessTargetMismatch { pid } => write!(
                formatter,
                "Selected process {pid} is not the source-controlled OPUS LLDB development harness"
            ),
            Self::JvmAttachProcessIdentityUnavailable { pid } => write!(
                formatter,
                "Cannot establish a stable process-instance identity for JVM Attach harness target {pid}"
            ),
            Self::JvmAttachSessionMissing { pid } => write!(
                formatter,
                "No active JVM Attach session exists for selected process {pid}"
            ),
            Self::JvmAttachSessionInvalid { pid, detail } => write!(
                formatter,
                "JVM Attach session for selected process {pid} is invalid: {detail}"
            ),
            Self::JvmAttachSessionMismatch { pid, detail } => write!(
                formatter,
                "JVM Attach session does not match selected process {pid}: {detail}"
            ),
            Self::JvmAttachSessionAlreadyRunning { pid } => write!(
                formatter,
                "JVM Attach session for selected process {pid} is already running"
            ),
            Self::JvmAttachSessionRecoveryRequired { pid, state } => write!(
                formatter,
                "JVM Attach harness session for selected process {pid} is in {state}; complete or retry its cleanup before loading again"
            ),
            Self::JvmAttachSessionNotRunning { pid } => write!(
                formatter,
                "JVM Attach session for selected process {pid} is not running"
            ),
            Self::JvmAttachSessionStorageFailed { detail } => {
                write!(
                    formatter,
                    "Unable to maintain private JVM Attach session state: {detail}"
                )
            }
            Self::NativeTransportHelperMissing { path } => write!(
                formatter,
                "Native transport helper is missing: {}",
                path.display()
            ),
            Self::NativeTransportHelperFailed { operation, detail } => write!(
                formatter,
                "Native transport helper failed during {operation}: {detail}"
            ),
            Self::NativeTransportTaskPortDenied { pid } => write!(
                formatter,
                "macOS did not grant a task port for selected process {pid}; no runtime load was attempted"
            ),
            Self::NativeTransportRosettaRemoteThreadUnavailable { pid } => write!(
                formatter,
                "Standard native transport cannot create a remote thread in selected x86_64 Rosetta target {pid} on this host; no protection bypass was attempted"
            ),
            Self::NativeTransportTimeout { operation } => {
                write!(formatter, "Native transport timed out during {operation}")
            }
            Self::NativeTransportProcessIdentityUnavailable { pid } => write!(
                formatter,
                "Cannot establish a stable process-instance identity for selected native transport target {pid}"
            ),
            Self::NativeTransportSessionMissing { pid } => write!(
                formatter,
                "No native transport session exists for selected process {pid}"
            ),
            Self::NativeTransportSessionInvalid { pid, detail } => write!(
                formatter,
                "Native transport session for selected process {pid} is invalid: {detail}"
            ),
            Self::NativeTransportSessionMismatch { pid, detail } => write!(
                formatter,
                "Native transport session does not match selected process {pid}: {detail}"
            ),
            Self::NativeTransportSessionAlreadyRunning { pid } => write!(
                formatter,
                "Native transport session for selected process {pid} is already running"
            ),
            Self::NativeTransportSessionRecoveryRequired { pid, state } => write!(
                formatter,
                "Native transport session for selected process {pid} is in {state}; complete or retry its cleanup before loading again"
            ),
            Self::NativeTransportSessionNotRunning { pid } => write!(
                formatter,
                "Native transport session for selected process {pid} is not running"
            ),
            Self::NativeTransportSessionStorageFailed { detail } => write!(
                formatter,
                "Unable to maintain private native transport session state: {detail}"
            ),
            Self::NativeTransportDescriptorMissing { pid, path } => write!(
                formatter,
                "Native transport target {pid} did not publish a runtime descriptor at {}",
                path.display()
            ),
            Self::NativeTransportDescriptorInvalid { pid, detail } => write!(
                formatter,
                "Native transport descriptor for selected process {pid} is invalid: {detail}"
            ),
            Self::NativeTransportConnectionFailed { operation, detail } => write!(
                formatter,
                "Native transport {operation} request could not connect: {detail}"
            ),
            Self::NativeTransportProtocolError { operation, detail } => write!(
                formatter,
                "Native transport {operation} protocol failed: {detail}"
            ),
            Self::NativeTransportRejected { operation, code } => write!(
                formatter,
                "Native transport rejected the {operation} request with code {code}"
            ),
        }
    }
}

impl Error for InjectorError {}

pub fn diagnostic_for(error: &InjectorError) -> Diagnostic {
    Diagnostic::new(error.phase(), error.code(), error.to_string())
}

fn executable_label(path: &Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .unwrap_or("<unknown>")
        .to_owned()
}

#[cfg(test)]
mod tests {
    use super::{Diagnostic, InjectorError, InjectorPhase, diagnostic_for};

    #[test]
    fn strips_control_characters_from_diagnostics() {
        let diagnostic = Diagnostic::new(InjectorPhase::Discovery, "Test", "line one\nline two");
        assert_eq!(
            diagnostic.render(),
            "[OPUS/INJECTOR] phase=discovery code=Test message=line one line two"
        );
    }

    #[test]
    fn target_executable_diagnostics_do_not_render_parent_paths() {
        let diagnostic = diagnostic_for(&InjectorError::TargetExecutableMissing {
            path: "/Users/example/Library/Application Support/Client/bin/java".into(),
        })
        .render();

        assert!(diagnostic.contains("java"));
        assert!(!diagnostic.contains("Application Support"));
        assert!(!diagnostic.contains("/Users/example"));
    }
}
