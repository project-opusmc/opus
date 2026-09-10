use crate::architecture::{
    TargetArchitecture, format_architectures, inspect_runtime_architectures,
    validate_runtime_architecture,
};
use crate::diagnostics::InjectorError;
use crate::transport::{PROTOCOL_VERSION, VersionHandshake, validate_foundation_handshake};
use std::collections::{BTreeMap, BTreeSet};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{ChildStdin, ChildStdout, Command, Stdio};
use std::sync::mpsc::{self, Receiver};
use std::thread;
use std::time::{Duration, Instant};

const READY_PREFIX: &str = "OPUS_OWNED_TARGET_READY ";
const UNLOADED_PREFIX: &str = "OPUS_OWNED_TARGET_UNLOADED ";
const EXIT_PREFIX: &str = "OPUS_OWNED_TARGET_EXIT ";
const LISTENING_PREFIX: &str = "OPUS_OWNED_TARGET_LISTENING ";
const RESPONSE_TIMEOUT: Duration = Duration::from_secs(10);
const MAX_CYCLES: u32 = 20;
const MAX_IGNORED_OUTPUT_LINES: usize = 32;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OwnedTargetConfig {
    pub java: PathBuf,
    pub classpath: PathBuf,
    pub runtime: PathBuf,
    pub target_architecture: TargetArchitecture,
    pub cycles: u32,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OwnedTargetReport {
    pub cycles: u32,
    pub same_process_cycles: bool,
    pub target_architecture: TargetArchitecture,
    pub runtime_architectures: BTreeSet<TargetArchitecture>,
}

pub fn exercise_owned_target(
    config: &OwnedTargetConfig,
) -> Result<OwnedTargetReport, InjectorError> {
    if config.cycles == 0 || config.cycles > MAX_CYCLES {
        return Err(InjectorError::InvalidArguments {
            message: format!("--cycles must be between 1 and {MAX_CYCLES}"),
        });
    }
    if !config.java.is_file() {
        return Err(InjectorError::OwnedTargetLaunchFailed {
            detail: format!("Java executable is missing: {}", config.java.display()),
        });
    }
    if !config.classpath.is_dir() {
        return Err(InjectorError::OwnedTargetLaunchFailed {
            detail: format!(
                "Classpath directory is missing: {}",
                config.classpath.display()
            ),
        });
    }

    let runtime = canonical_path(&config.runtime, "runtime")?;
    let classpath = canonical_path(&config.classpath, "classpath")?;
    let runtime_architectures = inspect_runtime_architectures(&runtime)?;
    validate_runtime_architecture(config.target_architecture, &runtime_architectures)?;
    let native_access_enabled = java_supports_native_access_flag(&config.java);

    exercise_owned_target_session(config, &runtime, &classpath, native_access_enabled)?;

    Ok(OwnedTargetReport {
        cycles: config.cycles,
        same_process_cycles: true,
        target_architecture: config.target_architecture,
        runtime_architectures,
    })
}

fn canonical_path(path: &Path, label: &str) -> Result<PathBuf, InjectorError> {
    path.canonicalize()
        .map_err(|error| InjectorError::OwnedTargetLaunchFailed {
            detail: format!("Unable to resolve {label} path {}: {error}", path.display()),
        })
}

fn java_supports_native_access_flag(java: &Path) -> bool {
    let output = match Command::new(java).arg("-version").output() {
        Ok(output) => output,
        Err(_) => return false,
    };
    let version_output = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    matches!(parse_java_major_version(&version_output), Some(major) if major >= 17)
}

fn parse_java_major_version(version_output: &str) -> Option<u32> {
    let version = version_output.split('"').nth(1)?;
    let mut components = version.split('.');
    let first = components.next()?;
    if first == "1" {
        components.next()?.parse().ok()
    } else {
        first.parse().ok()
    }
}

fn exercise_owned_target_session(
    config: &OwnedTargetConfig,
    runtime: &Path,
    classpath: &Path,
    native_access_enabled: bool,
) -> Result<(), InjectorError> {
    let mut command = Command::new(&config.java);
    command.arg("-Xcheck:jni");
    if native_access_enabled {
        command.arg("--enable-native-access=ALL-UNNAMED");
    }
    let mut child = command
        .arg(format!(
            "-Dopus.injector.version={}",
            env!("CARGO_PKG_VERSION")
        ))
        .arg("-cp")
        .arg(classpath)
        .arg("dev.opus.runtime.harness.OwnedRuntimeHarness")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|error| InjectorError::OwnedTargetLaunchFailed {
            detail: error.to_string(),
        })?;

    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| InjectorError::OwnedTargetLaunchFailed {
            detail: "Unable to open owned target stdin".to_owned(),
        })?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| InjectorError::OwnedTargetLaunchFailed {
            detail: "Unable to open owned target stdout".to_owned(),
        })?;
    let lines = spawn_line_reader(stdout);

    let result = (|| {
        let listening = receive_report(&lines, LISTENING_PREFIX, "listening")?;
        validate_listening_report(&listening, config.target_architecture)?;

        for _ in 0..config.cycles {
            write_command(&mut stdin, &format!("load {}", runtime.display()))?;
            let ready = receive_report(&lines, READY_PREFIX, "ready")?;
            validate_ready_report(&ready, config.target_architecture)?;

            write_command(&mut stdin, "unload")?;
            let unloaded = receive_report(&lines, UNLOADED_PREFIX, "unload")?;
            validate_unloaded_report(&unloaded, config.target_architecture)?;
        }

        write_command(&mut stdin, "exit")?;
        let exited = receive_report(&lines, EXIT_PREFIX, "exit")?;
        validate_exit_report(&exited, config.target_architecture)?;
        Ok(())
    })();

    if let Err(error) = result {
        let _ = child.kill();
        let _ = child.wait();
        return Err(error);
    }

    let status = child
        .wait()
        .map_err(|error| InjectorError::OwnedTargetLaunchFailed {
            detail: format!("Unable to wait for owned target: {error}"),
        })?;
    if !status.success() {
        return Err(InjectorError::OwnedTargetExitFailure {
            status: status.to_string(),
        });
    }
    Ok(())
}

fn spawn_line_reader(stdout: ChildStdout) -> Receiver<Result<String, String>> {
    let (sender, receiver) = mpsc::channel();
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            match line {
                Ok(value) => {
                    if sender.send(Ok(value)).is_err() {
                        return;
                    }
                }
                Err(error) => {
                    let _ = sender.send(Err(error.to_string()));
                    return;
                }
            }
        }
        let _ = sender.send(Err("owned target stdout closed unexpectedly".to_owned()));
    });
    receiver
}

fn receive_report(
    lines: &Receiver<Result<String, String>>,
    prefix: &str,
    stage: &'static str,
) -> Result<BTreeMap<String, String>, InjectorError> {
    let deadline = Instant::now() + RESPONSE_TIMEOUT;
    let mut ignored_lines = 0;
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            return Err(InjectorError::OwnedTargetTimeout { stage });
        }

        let line = match lines.recv_timeout(remaining) {
            Ok(Ok(line)) => line,
            Ok(Err(detail)) => {
                return Err(InjectorError::OwnedTargetProtocolError { stage, detail });
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {
                return Err(InjectorError::OwnedTargetTimeout { stage });
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                return Err(InjectorError::OwnedTargetProtocolError {
                    stage,
                    detail: "owned target stdout reader disconnected".to_owned(),
                });
            }
        };

        if line.starts_with(prefix) {
            return parse_report(&line, prefix, stage);
        }
        if line.starts_with("OPUS_OWNED_TARGET_") {
            return Err(InjectorError::OwnedTargetProtocolError {
                stage,
                detail: format!("Unexpected target report: {line}"),
            });
        }

        ignored_lines += 1;
        if ignored_lines > MAX_IGNORED_OUTPUT_LINES {
            return Err(InjectorError::OwnedTargetProtocolError {
                stage,
                detail: format!(
                    "Exceeded {MAX_IGNORED_OUTPUT_LINES} non-protocol output lines before target report"
                ),
            });
        }
    }
}

fn parse_report(
    line: &str,
    prefix: &str,
    stage: &'static str,
) -> Result<BTreeMap<String, String>, InjectorError> {
    let payload =
        line.strip_prefix(prefix)
            .ok_or_else(|| InjectorError::OwnedTargetProtocolError {
                stage,
                detail: format!("Unexpected target report: {line}"),
            })?;
    let mut values = BTreeMap::new();
    for entry in payload.split(';') {
        let (key, value) =
            entry
                .split_once('=')
                .ok_or_else(|| InjectorError::OwnedTargetProtocolError {
                    stage,
                    detail: format!("Malformed target report field: {entry}"),
                })?;
        if key.is_empty()
            || value.is_empty()
            || values.insert(key.to_owned(), value.to_owned()).is_some()
        {
            return Err(InjectorError::OwnedTargetProtocolError {
                stage,
                detail: format!("Invalid target report field: {entry}"),
            });
        }
    }
    Ok(values)
}

fn required_value<'a>(
    values: &'a BTreeMap<String, String>,
    key: &str,
    stage: &'static str,
) -> Result<&'a str, InjectorError> {
    values
        .get(key)
        .map(String::as_str)
        .ok_or_else(|| InjectorError::OwnedTargetProtocolError {
            stage,
            detail: format!("Missing target report field: {key}"),
        })
}

fn validate_listening_report(
    values: &BTreeMap<String, String>,
    expected_architecture: TargetArchitecture,
) -> Result<(), InjectorError> {
    let protocol_version = required_value(values, "protocolVersion", "listening")?
        .parse::<u32>()
        .map_err(|_| InjectorError::OwnedTargetProtocolError {
            stage: "listening",
            detail: "protocolVersion is not an integer".to_owned(),
        })?;
    if protocol_version != PROTOCOL_VERSION {
        return Err(InjectorError::HandshakeProtocolMismatch {
            expected: PROTOCOL_VERSION,
            actual: protocol_version,
        });
    }
    let injector_version = required_value(values, "injectorVersion", "listening")?;
    if injector_version != env!("CARGO_PKG_VERSION") {
        return Err(InjectorError::HandshakeVersionMismatch {
            component: "injector",
            expected: env!("CARGO_PKG_VERSION").to_owned(),
            actual: injector_version.to_owned(),
        });
    }

    let target_architecture =
        TargetArchitecture::parse(required_value(values, "targetArchitecture", "listening")?)?;
    if target_architecture != expected_architecture {
        return Err(InjectorError::HandshakeArchitectureMismatch {
            expected: expected_architecture,
            actual: target_architecture,
        });
    }
    if required_value(values, "state", "listening")? != "waiting" {
        return Err(InjectorError::OwnedTargetProtocolError {
            stage: "listening",
            detail: "Target did not enter waiting state".to_owned(),
        });
    }
    Ok(())
}

fn validate_ready_report(
    values: &BTreeMap<String, String>,
    expected_architecture: TargetArchitecture,
) -> Result<(), InjectorError> {
    validate_handshake(values, "ready", expected_architecture)?;
    if required_value(values, "state", "ready")? != "running" {
        return Err(InjectorError::OwnedTargetProtocolError {
            stage: "ready",
            detail: "Target did not enter running state".to_owned(),
        });
    }
    Ok(())
}

fn validate_unloaded_report(
    values: &BTreeMap<String, String>,
    expected_architecture: TargetArchitecture,
) -> Result<(), InjectorError> {
    validate_handshake(values, "unload", expected_architecture)?;
    if required_value(values, "state", "unload")? != "stopped" {
        return Err(InjectorError::OwnedTargetProtocolError {
            stage: "unload",
            detail: "Target did not enter stopped state".to_owned(),
        });
    }
    Ok(())
}

fn validate_exit_report(
    values: &BTreeMap<String, String>,
    expected_architecture: TargetArchitecture,
) -> Result<(), InjectorError> {
    validate_handshake(values, "exit", expected_architecture)?;
    if required_value(values, "state", "exit")? != "stopped" {
        return Err(InjectorError::OwnedTargetProtocolError {
            stage: "exit",
            detail: "Target exited before a clean stop".to_owned(),
        });
    }
    Ok(())
}

fn validate_handshake(
    values: &BTreeMap<String, String>,
    stage: &'static str,
    expected_architecture: TargetArchitecture,
) -> Result<(), InjectorError> {
    let protocol_version = required_value(values, "protocolVersion", stage)?
        .parse::<u32>()
        .map_err(|_| InjectorError::OwnedTargetProtocolError {
            stage,
            detail: "protocolVersion is not an integer".to_owned(),
        })?;

    let handshake = VersionHandshake {
        protocol_version,
        injector_version: required_value(values, "injectorVersion", stage)?.to_owned(),
        native_runtime_version: required_value(values, "nativeRuntimeVersion", stage)?.to_owned(),
        java_runtime_version: required_value(values, "javaRuntimeVersion", stage)?.to_owned(),
        target_architecture: TargetArchitecture::parse(required_value(
            values,
            "targetArchitecture",
            stage,
        )?)?,
        mapping_schema_version: required_value(values, "mappingSchemaVersion", stage)?.to_owned(),
        oneconfig_adapter_version: required_value(values, "oneConfigAdapterVersion", stage)?
            .to_owned(),
        artifact_checksums: required_value(values, "artifactChecksums", stage)?.to_owned(),
    };
    validate_foundation_handshake(&handshake, expected_architecture)
}

fn write_command(stdin: &mut ChildStdin, command: &str) -> Result<(), InjectorError> {
    stdin
        .write_all(command.as_bytes())
        .and_then(|()| stdin.write_all(b"\n"))
        .and_then(|()| stdin.flush())
        .map_err(|error| InjectorError::OwnedTargetProtocolError {
            stage: if command.starts_with("load ") {
                "load"
            } else if command == "unload" {
                "unload"
            } else {
                "exit"
            },
            detail: format!("Unable to send command: {error}"),
        })
}

pub fn report_summary(report: &OwnedTargetReport) -> String {
    format!(
        "cycles={} same_process_cycles={} logical_reentry_count={} target_architecture={} runtime_architectures={}",
        report.cycles,
        report.same_process_cycles,
        report.cycles.saturating_sub(1),
        report.target_architecture,
        format_architectures(&report.runtime_architectures)
    )
}

#[cfg(test)]
mod tests {
    use super::{
        LISTENING_PREFIX, READY_PREFIX, parse_java_major_version, parse_report, receive_report,
        validate_listening_report, validate_ready_report,
    };
    use crate::architecture::TargetArchitecture;
    use crate::diagnostics::InjectorError;
    use std::sync::mpsc;

    #[test]
    fn accepts_a_matching_ready_report() {
        let values = parse_report(
            "OPUS_OWNED_TARGET_READY protocolVersion=1;injectorVersion=0.1.0;nativeRuntimeVersion=0.1.0;javaRuntimeVersion=not-built;targetArchitecture=arm64;mappingSchemaVersion=not-applicable;oneConfigAdapterVersion=not-loaded;artifactChecksums=not-packaged;state=running",
            READY_PREFIX,
            "ready",
        )
        .expect("ready report should parse");
        validate_ready_report(&values, TargetArchitecture::Arm64)
            .expect("matching ready report should validate");
    }

    #[test]
    fn accepts_a_matching_listening_report() {
        let values = parse_report(
            "OPUS_OWNED_TARGET_LISTENING protocolVersion=1;injectorVersion=0.1.0;targetArchitecture=arm64;state=waiting",
            LISTENING_PREFIX,
            "listening",
        )
        .expect("listening report should parse");
        validate_listening_report(&values, TargetArchitecture::Arm64)
            .expect("matching listening report should validate");
    }

    #[test]
    fn rejects_an_owned_target_architecture_mismatch() {
        let values = parse_report(
            "OPUS_OWNED_TARGET_READY protocolVersion=1;injectorVersion=0.1.0;nativeRuntimeVersion=0.1.0;javaRuntimeVersion=not-built;targetArchitecture=x86_64;mappingSchemaVersion=not-applicable;oneConfigAdapterVersion=not-loaded;artifactChecksums=not-packaged;state=running",
            READY_PREFIX,
            "ready",
        )
        .expect("ready report should parse");
        let error = validate_ready_report(&values, TargetArchitecture::Arm64)
            .expect_err("mismatched architecture must fail");
        assert!(matches!(
            error,
            InjectorError::HandshakeArchitectureMismatch { .. }
        ));
    }

    #[test]
    fn ignores_non_protocol_output_before_a_ready_report() {
        let (sender, receiver) = mpsc::channel();
        sender
            .send(Ok(
                "WARNING in native method: JVM checker emitted a diagnostic".to_owned(),
            ))
            .expect("warning line should send");
        sender
            .send(Ok(
                "OPUS_OWNED_TARGET_READY protocolVersion=1;injectorVersion=0.1.0;nativeRuntimeVersion=0.1.0;javaRuntimeVersion=not-built;targetArchitecture=arm64;mappingSchemaVersion=not-applicable;oneConfigAdapterVersion=not-loaded;artifactChecksums=not-packaged;state=running"
                    .to_owned(),
            ))
            .expect("ready line should send");

        let values = receive_report(&receiver, READY_PREFIX, "ready")
            .expect("ready report should follow the warning line");
        validate_ready_report(&values, TargetArchitecture::Arm64)
            .expect("ready report should remain valid");
    }

    #[test]
    fn rejects_the_wrong_owned_target_protocol_frame() {
        let (sender, receiver) = mpsc::channel();
        sender
            .send(Ok(
                "OPUS_OWNED_TARGET_UNLOADED protocol_version=1;runtime_version=0.1.0;state=stopped"
                    .to_owned(),
            ))
            .expect("unload line should send");

        let error = receive_report(&receiver, READY_PREFIX, "ready")
            .expect_err("an unload frame cannot satisfy ready");
        assert!(matches!(
            error,
            InjectorError::OwnedTargetProtocolError { .. }
        ));
    }

    #[test]
    fn parses_java_8_and_modern_java_major_versions() {
        assert_eq!(
            parse_java_major_version("java version \"1.8.0_502\""),
            Some(8)
        );
        assert_eq!(
            parse_java_major_version("openjdk version \"25.0.2\" 2026-01-20"),
            Some(25)
        );
    }

    #[test]
    fn rejects_a_mismatched_native_runtime_version() {
        let values = parse_report(
            "OPUS_OWNED_TARGET_READY protocolVersion=1;injectorVersion=0.1.0;nativeRuntimeVersion=0.2.0;javaRuntimeVersion=not-built;targetArchitecture=arm64;mappingSchemaVersion=not-applicable;oneConfigAdapterVersion=not-loaded;artifactChecksums=not-packaged;state=running",
            READY_PREFIX,
            "ready",
        )
        .expect("ready report should parse");

        let error = validate_ready_report(&values, TargetArchitecture::Arm64)
            .expect_err("native runtime version mismatch must fail");
        assert!(matches!(
            error,
            InjectorError::HandshakeVersionMismatch {
                component: "native-runtime",
                ..
            }
        ));
    }
}
