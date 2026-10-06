#![forbid(unsafe_code)]

use opus_injector::{
    AuthorizedTargetOperation, CodeSignInspector, CooperativeTargetKind, Diagnostic, InjectorError,
    InjectorPhase, JvmAttachConfig, MinecraftJvmCandidate, OwnedTargetConfig, ProcessSnapshot,
    TargetArchitecture, current_user_id, diagnostic_for, exercise_owned_target,
    find_owned_minecraft_jvm_candidate, find_process, inspect_executable_architectures,
    inspect_runtime_architectures, inspect_system_processes, lunar_launcher_processes,
    minecraft_jvm_candidates, prepare_load, probe_lldb_development_harness,
    render_preflight_report_json, report_summary, request_authorized_target,
    request_jvm_attach_harness_load, request_jvm_attach_harness_unload,
    request_native_transport_health, request_native_transport_load, request_native_transport_stop,
    request_native_transport_unload, request_opus_owned_client,
    select_thin_executable_architecture,
};
use std::collections::BTreeMap;
use std::env;
use std::path::{Path, PathBuf};
use std::process;

#[derive(Debug)]
enum CliCommand {
    Inspect {
        pid: Option<u32>,
    },
    RuntimeInfo {
        runtime: PathBuf,
    },
    Prepare {
        pid: u32,
        target_architecture: TargetArchitecture,
        runtime: PathBuf,
    },
    PrepareJson {
        pid: u32,
        target_architecture: TargetArchitecture,
        runtime: PathBuf,
    },
    PrepareAuto {
        pid: u32,
        runtime: PathBuf,
    },
    RequestLoad {
        pid: u32,
        target_architecture: TargetArchitecture,
        runtime: PathBuf,
        transport_helper: Option<PathBuf>,
    },
    RequestUnload {
        pid: u32,
    },
    RequestHealth {
        pid: u32,
    },
    RequestStop {
        pid: u32,
    },
    ProbeJvmAttach {
        pid: u32,
    },
    ProbeNativeTransport {
        pid: u32,
        target_architecture: TargetArchitecture,
        transport_helper: Option<PathBuf>,
    },
    AttachHarnessLoad {
        pid: u32,
        target_architecture: TargetArchitecture,
        runtime: PathBuf,
        attach_java: PathBuf,
        attach_classpath: PathBuf,
    },
    AttachHarnessUnload {
        pid: u32,
        attach_java: PathBuf,
        attach_classpath: PathBuf,
    },
    LldbHarnessProbe {
        pid: u32,
    },
    OwnedHarness {
        java: PathBuf,
        classpath: PathBuf,
        runtime: PathBuf,
        target_architecture: TargetArchitecture,
        cycles: u32,
    },
    CooperativeTarget {
        target_kind: CooperativeTargetKind,
        operation: AuthorizedTargetOperation,
        descriptor: PathBuf,
        runtime: Option<PathBuf>,
        expected_state: Option<String>,
    },
    Contract,
}

fn main() {
    if let Err(error) = run() {
        eprintln!("{}", diagnostic_for(&error).render());
        process::exit(2);
    }
}

fn run() -> Result<(), InjectorError> {
    let command = parse_cli(env::args().skip(1).collect())?;
    match command {
        CliCommand::Inspect { pid } => inspect(pid),
        CliCommand::RuntimeInfo { runtime } => runtime_info(&runtime),
        CliCommand::Prepare {
            pid,
            target_architecture,
            runtime,
        } => prepare(pid, target_architecture, &runtime),
        CliCommand::PrepareJson {
            pid,
            target_architecture,
            runtime,
        } => prepare_json(pid, target_architecture, &runtime),
        CliCommand::PrepareAuto { pid, runtime } => prepare_auto(pid, &runtime),
        CliCommand::RequestLoad {
            pid,
            target_architecture,
            runtime,
            transport_helper,
        } => request_load(
            pid,
            target_architecture,
            &runtime,
            transport_helper.as_deref(),
        ),
        CliCommand::RequestUnload { pid } => request_unload(pid),
        CliCommand::RequestHealth { pid } => request_health(pid),
        CliCommand::RequestStop { pid } => request_stop(pid),
        CliCommand::ProbeJvmAttach { pid } => probe_jvm_attach_cli(pid),
        CliCommand::ProbeNativeTransport {
            pid,
            target_architecture,
            transport_helper,
        } => probe_native_transport_cli(pid, target_architecture, transport_helper.as_deref()),
        CliCommand::AttachHarnessLoad {
            pid,
            target_architecture,
            runtime,
            attach_java,
            attach_classpath,
        } => attach_harness_load(
            pid,
            target_architecture,
            &runtime,
            JvmAttachConfig {
                java: attach_java,
                classpath: attach_classpath,
            },
        ),
        CliCommand::AttachHarnessUnload {
            pid,
            attach_java,
            attach_classpath,
        } => attach_harness_unload(
            pid,
            JvmAttachConfig {
                java: attach_java,
                classpath: attach_classpath,
            },
        ),
        CliCommand::LldbHarnessProbe { pid } => lldb_harness_probe(pid),
        CliCommand::OwnedHarness {
            java,
            classpath,
            runtime,
            target_architecture,
            cycles,
        } => owned_harness(java, classpath, runtime, target_architecture, cycles),
        CliCommand::CooperativeTarget {
            target_kind,
            operation,
            descriptor,
            runtime,
            expected_state,
        } => cooperative_target(target_kind, operation, descriptor, runtime, expected_state),
        CliCommand::Contract => contract(),
    }
}

fn parse_cli(arguments: Vec<String>) -> Result<CliCommand, InjectorError> {
    let Some((command, arguments)) = arguments.split_first() else {
        print_usage();
        return Err(InjectorError::InvalidArguments {
            message: "A command is required".to_owned(),
        });
    };
    if command == "--help" || command == "-h" {
        print_usage();
        process::exit(0);
    }
    if command == "--version" || command == "-V" {
        println!("opus-injector {}", env!("CARGO_PKG_VERSION"));
        process::exit(0);
    }

    match command.as_str() {
        "inspect" => {
            let options = parse_options(arguments, &["--pid"])?;
            Ok(CliCommand::Inspect {
                pid: optional_pid(&options, "--pid")?,
            })
        }
        "runtime-info" => {
            let options = parse_options(arguments, &["--runtime"])?;
            Ok(CliCommand::RuntimeInfo {
                runtime: required_path(&options, "--runtime")?,
            })
        }
        "prepare" | "prepare-json" => {
            let options =
                parse_options(arguments, &["--pid", "--target-architecture", "--runtime"])?;
            let pid = required_pid(&options, "--pid")?;
            let target_architecture =
                TargetArchitecture::parse(required_value(&options, "--target-architecture")?)?;
            let runtime = required_path(&options, "--runtime")?;
            if command == "prepare" {
                Ok(CliCommand::Prepare {
                    pid,
                    target_architecture,
                    runtime,
                })
            } else {
                Ok(CliCommand::PrepareJson {
                    pid,
                    target_architecture,
                    runtime,
                })
            }
        }
        "request-load" => {
            let options = parse_options(
                arguments,
                &[
                    "--pid",
                    "--target-architecture",
                    "--runtime",
                    "--transport-helper",
                ],
            )?;
            Ok(CliCommand::RequestLoad {
                pid: required_pid(&options, "--pid")?,
                target_architecture: TargetArchitecture::parse(required_value(
                    &options,
                    "--target-architecture",
                )?)?,
                runtime: required_path(&options, "--runtime")?,
                transport_helper: optional_path(&options, "--transport-helper"),
            })
        }
        "prepare-auto" => {
            let options = parse_options(arguments, &["--pid", "--runtime"])?;
            Ok(CliCommand::PrepareAuto {
                pid: required_pid(&options, "--pid")?,
                runtime: required_path(&options, "--runtime")?,
            })
        }
        "request-unload" => {
            let options = parse_options(arguments, &["--pid"])?;
            Ok(CliCommand::RequestUnload {
                pid: required_pid(&options, "--pid")?,
            })
        }
        "request-health" => {
            let options = parse_options(arguments, &["--pid"])?;
            Ok(CliCommand::RequestHealth {
                pid: required_pid(&options, "--pid")?,
            })
        }
        "request-stop" => {
            let options = parse_options(arguments, &["--pid"])?;
            Ok(CliCommand::RequestStop {
                pid: required_pid(&options, "--pid")?,
            })
        }
        "probe-jvm-attach" => {
            let options = parse_options(arguments, &["--pid"])?;
            Ok(CliCommand::ProbeJvmAttach {
                pid: required_pid(&options, "--pid")?,
            })
        }
        "probe-native" => {
            let options = parse_options(
                arguments,
                &["--pid", "--target-architecture", "--transport-helper"],
            )?;
            Ok(CliCommand::ProbeNativeTransport {
                pid: required_pid(&options, "--pid")?,
                target_architecture: TargetArchitecture::parse(required_value(
                    &options,
                    "--target-architecture",
                )?)?,
                transport_helper: optional_path(&options, "--transport-helper"),
            })
        }
        "attach-harness" => parse_attach_harness(arguments),
        "lldb-harness" => parse_lldb_harness(arguments),
        "owned-harness" => {
            let options = parse_options(
                arguments,
                &[
                    "--java",
                    "--classpath",
                    "--runtime",
                    "--target-architecture",
                    "--cycles",
                ],
            )?;
            Ok(CliCommand::OwnedHarness {
                java: required_path(&options, "--java")?,
                classpath: required_path(&options, "--classpath")?,
                runtime: required_path(&options, "--runtime")?,
                target_architecture: TargetArchitecture::parse(required_value(
                    &options,
                    "--target-architecture",
                )?)?,
                cycles: optional_u32(&options, "--cycles")?.unwrap_or(1),
            })
        }
        "authorized-target" => {
            parse_cooperative_target(arguments, CooperativeTargetKind::AuthorizedTestHarness)
        }
        "opus-owned-client" => {
            parse_cooperative_target(arguments, CooperativeTargetKind::OpusOwnedClient)
        }
        "contract" => {
            if arguments.is_empty() {
                Ok(CliCommand::Contract)
            } else {
                Err(InjectorError::InvalidArguments {
                    message: "contract does not accept options".to_owned(),
                })
            }
        }
        _ => Err(InjectorError::InvalidArguments {
            message: format!("Unknown command: {command}"),
        }),
    }
}

fn parse_cooperative_target(
    arguments: &[String],
    target_kind: CooperativeTargetKind,
) -> Result<CliCommand, InjectorError> {
    let Some((operation, operation_arguments)) = arguments.split_first() else {
        return Err(InjectorError::InvalidArguments {
            message:
                "cooperative target requires an operation: load, unload, health, stop, or close-game"
                    .to_owned(),
        });
    };
    let operation = AuthorizedTargetOperation::parse(operation)?;
    if operation == AuthorizedTargetOperation::CloseGame
        && target_kind != CooperativeTargetKind::OpusOwnedClient
    {
        return Err(InjectorError::InvalidArguments {
            message: "close-game is only available for an explicit OPUS-owned client preview"
                .to_owned(),
        });
    }
    let allowed_options = match operation {
        AuthorizedTargetOperation::Load => &["--descriptor", "--runtime"][..],
        AuthorizedTargetOperation::Health => &["--descriptor", "--expect-state"][..],
        AuthorizedTargetOperation::Unload
        | AuthorizedTargetOperation::Stop
        | AuthorizedTargetOperation::CloseGame => &["--descriptor"][..],
    };
    let options = parse_options(operation_arguments, allowed_options)?;
    Ok(CliCommand::CooperativeTarget {
        target_kind,
        operation,
        descriptor: required_path(&options, "--descriptor")?,
        runtime: options.get("--runtime").map(PathBuf::from),
        expected_state: options.get("--expect-state").cloned(),
    })
}

fn parse_attach_harness(arguments: &[String]) -> Result<CliCommand, InjectorError> {
    let Some((operation, operation_arguments)) = arguments.split_first() else {
        return Err(InjectorError::InvalidArguments {
            message: "attach-harness requires an operation: load or unload".to_owned(),
        });
    };
    match operation.as_str() {
        "load" => {
            let options = parse_options(
                operation_arguments,
                &[
                    "--pid",
                    "--target-architecture",
                    "--runtime",
                    "--attach-java",
                    "--attach-classpath",
                ],
            )?;
            Ok(CliCommand::AttachHarnessLoad {
                pid: required_pid(&options, "--pid")?,
                target_architecture: TargetArchitecture::parse(required_value(
                    &options,
                    "--target-architecture",
                )?)?,
                runtime: required_path(&options, "--runtime")?,
                attach_java: optional_path(&options, "--attach-java")
                    .unwrap_or_else(|| PathBuf::from("java")),
                attach_classpath: required_path(&options, "--attach-classpath")?,
            })
        }
        "unload" => {
            let options = parse_options(
                operation_arguments,
                &["--pid", "--attach-java", "--attach-classpath"],
            )?;
            Ok(CliCommand::AttachHarnessUnload {
                pid: required_pid(&options, "--pid")?,
                attach_java: optional_path(&options, "--attach-java")
                    .unwrap_or_else(|| PathBuf::from("java")),
                attach_classpath: required_path(&options, "--attach-classpath")?,
            })
        }
        _ => Err(InjectorError::InvalidArguments {
            message: "attach-harness operation must be load or unload".to_owned(),
        }),
    }
}

fn parse_lldb_harness(arguments: &[String]) -> Result<CliCommand, InjectorError> {
    let Some((operation, operation_arguments)) = arguments.split_first() else {
        return Err(InjectorError::InvalidArguments {
            message: "lldb-harness requires the probe operation".to_owned(),
        });
    };
    if operation != "probe" {
        return Err(InjectorError::InvalidArguments {
            message: "lldb-harness only supports the probe operation".to_owned(),
        });
    }
    let options = parse_options(operation_arguments, &["--pid"])?;
    Ok(CliCommand::LldbHarnessProbe {
        pid: required_pid(&options, "--pid")?,
    })
}

fn parse_options(
    arguments: &[String],
    allowed: &[&str],
) -> Result<BTreeMap<String, String>, InjectorError> {
    let mut options = BTreeMap::new();
    let mut index = 0;
    while index < arguments.len() {
        let name = &arguments[index];
        if !allowed.contains(&name.as_str()) {
            return Err(InjectorError::InvalidArguments {
                message: format!("Unsupported option: {name}"),
            });
        }
        let value = arguments
            .get(index + 1)
            .filter(|value| !value.starts_with("--"))
            .ok_or_else(|| InjectorError::InvalidArguments {
                message: format!("{name} requires a value"),
            })?;
        if options.insert(name.clone(), value.clone()).is_some() {
            return Err(InjectorError::InvalidArguments {
                message: format!("{name} was provided more than once"),
            });
        }
        index += 2;
    }
    Ok(options)
}

fn required_value<'a>(
    options: &'a BTreeMap<String, String>,
    name: &str,
) -> Result<&'a str, InjectorError> {
    options
        .get(name)
        .map(String::as_str)
        .ok_or_else(|| InjectorError::InvalidArguments {
            message: format!("{name} is required"),
        })
}

fn required_pid(options: &BTreeMap<String, String>, name: &str) -> Result<u32, InjectorError> {
    required_value(options, name)?
        .parse::<u32>()
        .map_err(|_| InjectorError::InvalidArguments {
            message: format!("{name} must be a positive integer"),
        })
}

fn optional_pid(
    options: &BTreeMap<String, String>,
    name: &str,
) -> Result<Option<u32>, InjectorError> {
    options
        .get(name)
        .map(|value| {
            value
                .parse::<u32>()
                .map_err(|_| InjectorError::InvalidArguments {
                    message: format!("{name} must be a positive integer"),
                })
        })
        .transpose()
}

fn optional_u32(
    options: &BTreeMap<String, String>,
    name: &str,
) -> Result<Option<u32>, InjectorError> {
    options
        .get(name)
        .map(|value| {
            value
                .parse::<u32>()
                .map_err(|_| InjectorError::InvalidArguments {
                    message: format!("{name} must be a positive integer"),
                })
        })
        .transpose()
}

fn required_path(options: &BTreeMap<String, String>, name: &str) -> Result<PathBuf, InjectorError> {
    Ok(PathBuf::from(required_value(options, name)?))
}

fn optional_path(options: &BTreeMap<String, String>, name: &str) -> Option<PathBuf> {
    options.get(name).map(PathBuf::from)
}

fn inspect(pid: Option<u32>) -> Result<(), InjectorError> {
    let processes = inspect_system_processes()?;
    let current_user_id = current_user_id()?;
    if let Some(pid) = pid {
        let target = find_process(&processes, pid)?;
        report(
            InjectorPhase::TargetSelection,
            "TargetInspected",
            target_summary(target, current_user_id),
        );
        let code_signing = CodeSignInspector.inspect(Path::new(&target.executable));
        report(
            InjectorPhase::TargetSelection,
            "CodeSigningInspected",
            format!("pid={} {}", target.pid, code_signing.summary()),
        );
        return Ok(());
    }

    let candidates = minecraft_jvm_candidates(&processes);
    let lunar_launchers = lunar_launcher_processes(&processes);
    report(
        InjectorPhase::Discovery,
        "DiscoveryComplete",
        format!("candidate_count={}", candidates.len()),
    );
    if candidates.is_empty() && !lunar_launchers.is_empty() {
        let launcher_pids = lunar_launchers
            .iter()
            .map(|launcher| launcher.pid.to_string())
            .collect::<Vec<_>>()
            .join(",");
        report(
            InjectorPhase::Discovery,
            "LunarLauncherOpenNoGameJvm",
            format!(
                "lunar_launcher_count={} launcher_pids={} candidate_count=0 action=launch_a_game_session_then_rerun_inspect",
                lunar_launchers.len(),
                launcher_pids
            ),
        );
    }
    for candidate in candidates {
        report(
            InjectorPhase::Discovery,
            "Candidate",
            candidate_summary(&candidate, current_user_id),
        );
    }
    Ok(())
}

fn target_summary(target: &ProcessSnapshot, current_user_id: u32) -> String {
    if let Some(candidate) = target.minecraft_jvm_candidate() {
        return candidate_summary(&candidate, current_user_id);
    }

    format!(
        "pid={} parent_pid={} executable={} minecraft_jvm_candidate=false target_ownership={} client_hint=unknown candidate_evidence=none",
        target.pid,
        target.parent_pid,
        target.executable_name(),
        target.ownership_for(current_user_id),
    )
}

fn candidate_summary(candidate: &MinecraftJvmCandidate, current_user_id: u32) -> String {
    format!(
        "pid={} parent_pid={} executable={} minecraft_jvm_candidate=true target_ownership={} client_hint={} candidate_evidence={}",
        candidate.process.pid,
        candidate.process.parent_pid,
        candidate.process.executable_name(),
        candidate.process.ownership_for(current_user_id),
        candidate.client_hint,
        candidate.evidence_summary(),
    )
}

fn runtime_info(runtime: &Path) -> Result<(), InjectorError> {
    let architectures = inspect_runtime_architectures(runtime)?;
    report(
        InjectorPhase::ArchitectureValidation,
        "RuntimeArchitecture",
        format!(
            "runtime={} architectures={}",
            runtime.display(),
            opus_injector::format_architectures(&architectures)
        ),
    );
    Ok(())
}

fn prepare(
    pid: u32,
    target_architecture: TargetArchitecture,
    runtime: &Path,
) -> Result<(), InjectorError> {
    let processes = inspect_system_processes()?;
    let current_user_id = current_user_id()?;
    let runtime_architectures = inspect_runtime_architectures(runtime)?;
    let preparation = prepare_load(
        &processes,
        pid,
        current_user_id,
        target_architecture,
        runtime_architectures,
    )?;
    report(
        InjectorPhase::ArchitectureValidation,
        "ArchitectureValidated",
        preparation.summary(),
    );
    report(
        InjectorPhase::LoadTransport,
        "TransportBoundary",
        "Preflight complete; no target-process load was attempted",
    );
    Ok(())
}

fn prepare_json(
    pid: u32,
    target_architecture: TargetArchitecture,
    runtime: &Path,
) -> Result<(), InjectorError> {
    let processes = inspect_system_processes()?;
    let current_user_id = current_user_id()?;
    let runtime_architectures = inspect_runtime_architectures(runtime)?;
    let preparation = prepare_load(
        &processes,
        pid,
        current_user_id,
        target_architecture,
        runtime_architectures,
    )?;
    println!("{}", render_preflight_report_json(&preparation));
    Ok(())
}

fn prepare_auto(pid: u32, runtime: &Path) -> Result<(), InjectorError> {
    let processes = inspect_system_processes()?;
    let current_user_id = current_user_id()?;
    let target = find_owned_minecraft_jvm_candidate(&processes, pid, current_user_id)?;

    let executable_architectures =
        inspect_executable_architectures(Path::new(&target.process.executable))?;
    let target_architecture = select_thin_executable_architecture(&executable_architectures)?;
    report(
        InjectorPhase::ArchitectureValidation,
        "TargetArchitectureInferred",
        format!(
            "pid={} executable={} client_hint={} target_architecture={} source=single-macho-executable",
            target.process.pid,
            target.process.executable_name(),
            target.client_hint,
            target_architecture
        ),
    );

    let runtime_architectures = inspect_runtime_architectures(runtime)?;
    let preparation = prepare_load(
        &processes,
        pid,
        current_user_id,
        target_architecture,
        runtime_architectures,
    )?;
    report(
        InjectorPhase::ArchitectureValidation,
        "ArchitectureValidated",
        preparation.summary(),
    );
    report(
        InjectorPhase::LoadTransport,
        "TransportBoundary",
        "Preflight complete; no target-process load was attempted",
    );
    Ok(())
}

fn request_load(
    pid: u32,
    target_architecture: TargetArchitecture,
    runtime: &Path,
    transport_helper: Option<&Path>,
) -> Result<(), InjectorError> {
    let processes = inspect_system_processes()?;
    let current_user_id = current_user_id()?;
    let runtime_architectures = inspect_runtime_architectures(runtime)?;
    let preparation = prepare_load(
        &processes,
        pid,
        current_user_id,
        target_architecture,
        runtime_architectures,
    )?;
    let report_data = request_native_transport_load(
        &processes,
        current_user_id,
        &preparation,
        runtime,
        transport_helper,
    )?;
    report(
        InjectorPhase::LoadTransport,
        "NativeTransportLoadReady",
        format!(
            "explicit_pid=true target_ownership=current-user native_runtime_entry=true versioned_handshake=true client_adapter=not-certified {}",
            report_data.summary()
        ),
    );
    Ok(())
}

fn request_unload(pid: u32) -> Result<(), InjectorError> {
    let processes = inspect_system_processes()?;
    let current_user_id = current_user_id()?;
    let report_data = request_native_transport_unload(&processes, current_user_id, pid)?;
    report(
        InjectorPhase::UnloadTransport,
        "NativeTransportUnloadStopped",
        format!(
            "explicit_pid=true target_ownership=current-user logical_shutdown=true target_survival_required=true {}",
            report_data.summary()
        ),
    );
    Ok(())
}

fn request_health(pid: u32) -> Result<(), InjectorError> {
    let processes = inspect_system_processes()?;
    let current_user_id = current_user_id()?;
    let report_data = request_native_transport_health(&processes, current_user_id, pid)?;
    report(
        InjectorPhase::LoadTransport,
        "NativeTransportHealth",
        format!(
            "explicit_pid=true target_ownership=current-user target_alive=true {}",
            report_data.summary()
        ),
    );
    Ok(())
}

fn request_stop(pid: u32) -> Result<(), InjectorError> {
    let processes = inspect_system_processes()?;
    let current_user_id = current_user_id()?;
    let report_data = request_native_transport_stop(&processes, current_user_id, pid)?;
    report(
        InjectorPhase::UnloadTransport,
        "NativeTransportControlStopped",
        format!(
            "explicit_pid=true target_ownership=current-user logical_runtime_stopped=true control_endpoint_closed=true {}",
            report_data.summary()
        ),
    );
    Ok(())
}

fn probe_jvm_attach_cli(pid: u32) -> Result<(), InjectorError> {
    let processes = inspect_system_processes()?;
    let current_user_id = current_user_id()?;
    let report_data = opus_injector::probe_jvm_attach_capability(&processes, current_user_id, pid)?;
    report(
        InjectorPhase::TargetSelection,
        "JvmAttachCapability",
        report_data.summary(),
    );
    Ok(())
}

fn probe_native_transport_cli(
    pid: u32,
    target_architecture: TargetArchitecture,
    transport_helper: Option<&Path>,
) -> Result<(), InjectorError> {
    let processes = inspect_system_processes()?;
    let current_user_id = current_user_id()?;
    let report_data = opus_injector::probe_native_transport(
        &processes,
        current_user_id,
        pid,
        target_architecture,
        transport_helper,
    )?;
    let (recommended_backend, result, reason) = native_backend_availability(report_data.status);
    report(
        InjectorPhase::TargetSelection,
        "BackendAvailability",
        format!(
            "jvm_attach=probe-separately-diagnostic-only lldb=restricted-to-owned-harness recommended_backend={} result={} reason={} {}",
            recommended_backend,
            result,
            reason,
            report_data.summary(),
        ),
    );
    Ok(())
}

fn native_backend_availability(
    status: opus_injector::NativeTransportProbeStatus,
) -> (&'static str, &'static str, &'static str) {
    match status {
        opus_injector::NativeTransportProbeStatus::Available => (
            "native",
            "CAPABILITY_AVAILABLE",
            "the selected target exposed the native task-port probe path",
        ),
        opus_injector::NativeTransportProbeStatus::TaskPortDenied => (
            "none",
            "UNSUPPORTED_TARGET_CONFIGURATION",
            "no supported instrumentation path is exposed by the selected target configuration",
        ),
    }
}

fn attach_harness_load(
    pid: u32,
    target_architecture: TargetArchitecture,
    runtime: &Path,
    attach_config: JvmAttachConfig,
) -> Result<(), InjectorError> {
    let processes = inspect_system_processes()?;
    let current_user_id = current_user_id()?;
    let report_data = request_jvm_attach_harness_load(
        &processes,
        pid,
        current_user_id,
        target_architecture,
        runtime,
        &attach_config,
    )?;
    report(
        InjectorPhase::LoadTransport,
        "AttachHarnessLoadProof",
        format!(
            "test_harness=true explicit_pid=true target_ownership=current-user native_agent_attach=true native_runtime_entry=true versioned_handshake=true {}",
            report_data.summary()
        ),
    );
    Ok(())
}

fn attach_harness_unload(pid: u32, attach_config: JvmAttachConfig) -> Result<(), InjectorError> {
    let processes = inspect_system_processes()?;
    let current_user_id = current_user_id()?;
    let report_data =
        request_jvm_attach_harness_unload(&processes, pid, current_user_id, &attach_config)?;
    report(
        InjectorPhase::UnloadTransport,
        "AttachHarnessLogicalStopProof",
        format!(
            "test_harness=true explicit_pid=true target_ownership=current-user logical_shutdown=true native_dylib_unload=false target_survival_required=true {}",
            report_data.summary()
        ),
    );
    Ok(())
}

fn lldb_harness_probe(pid: u32) -> Result<(), InjectorError> {
    let processes = inspect_system_processes()?;
    let current_user_id = current_user_id()?;
    let report_data = probe_lldb_development_harness(&processes, current_user_id, pid)?;
    report(
        InjectorPhase::TargetSelection,
        "LldbDevelopmentProbe",
        report_data.summary(),
    );
    Ok(())
}

fn owned_harness(
    java: PathBuf,
    classpath: PathBuf,
    runtime: PathBuf,
    target_architecture: TargetArchitecture,
    cycles: u32,
) -> Result<(), InjectorError> {
    let lifecycle = exercise_owned_target(&OwnedTargetConfig {
        java,
        classpath,
        runtime,
        target_architecture,
        cycles,
    })?;
    let summary = report_summary(&lifecycle);
    report(
        InjectorPhase::LoadTransport,
        "OwnedTargetLoadProof",
        format!(
            "owned_target=true cooperative_load_request=true native_runtime_entry=true versioned_handshake=true {summary}"
        ),
    );
    report(
        InjectorPhase::UnloadTransport,
        "OwnedTargetUnloadProof",
        format!("owned_target=true logical_shutdown=true process_exit=success {summary}"),
    );
    Ok(())
}

fn cooperative_target(
    target_kind: CooperativeTargetKind,
    operation: AuthorizedTargetOperation,
    descriptor: PathBuf,
    runtime: Option<PathBuf>,
    expected_state: Option<String>,
) -> Result<(), InjectorError> {
    let report_data = match target_kind {
        CooperativeTargetKind::AuthorizedTestHarness => request_authorized_target(
            &descriptor,
            operation,
            runtime.as_deref(),
            expected_state.as_deref(),
        )?,
        CooperativeTargetKind::OpusOwnedClient => request_opus_owned_client(
            &descriptor,
            operation,
            runtime.as_deref(),
            expected_state.as_deref(),
        )?,
    };
    let summary = report_data.summary();
    let (code, message) = match (target_kind, operation) {
        (CooperativeTargetKind::AuthorizedTestHarness, AuthorizedTargetOperation::Load) => (
            "AuthorizedTargetLoadProof",
            format!(
                "test_fixture=true explicit_descriptor=true capability_authorized=true native_runtime_entry=true versioned_handshake=true {summary}"
            ),
        ),
        (CooperativeTargetKind::AuthorizedTestHarness, AuthorizedTargetOperation::Unload) => (
            "AuthorizedTargetUnloadProof",
            format!(
                "test_fixture=true explicit_descriptor=true capability_authorized=true logical_shutdown=true {summary}"
            ),
        ),
        (CooperativeTargetKind::AuthorizedTestHarness, AuthorizedTargetOperation::Health) => (
            "AuthorizedTargetSurvivalProof",
            format!(
                "test_fixture=true target_alive=true explicit_descriptor=true capability_authorized=true {summary}"
            ),
        ),
        (CooperativeTargetKind::AuthorizedTestHarness, AuthorizedTargetOperation::Stop) => (
            "AuthorizedTargetStopProof",
            format!(
                "test_fixture=true explicit_descriptor=true capability_authorized=true clean_target_stop_requested=true {summary}"
            ),
        ),
        (CooperativeTargetKind::AuthorizedTestHarness, AuthorizedTargetOperation::CloseGame) => {
            unreachable!("close-game is rejected before an authorized test-harness request")
        }
        (CooperativeTargetKind::OpusOwnedClient, AuthorizedTargetOperation::Load) => (
            "OpusOwnedClientLoadProof",
            format!(
                "test_fixture=false target_kind=opus-owned-client explicit_descriptor=true capability_authorized=true target_self_loads_authorized_runtime=true native_runtime_entry=true versioned_handshake=true capture_required=true {summary}"
            ),
        ),
        (CooperativeTargetKind::OpusOwnedClient, AuthorizedTargetOperation::Unload) => (
            "OpusOwnedClientUnloadProof",
            format!(
                "test_fixture=false target_kind=opus-owned-client explicit_descriptor=true capability_authorized=true logical_shutdown=true capture_required=true {summary}"
            ),
        ),
        (CooperativeTargetKind::OpusOwnedClient, AuthorizedTargetOperation::Health) => (
            "OpusOwnedClientSurvivalProof",
            format!(
                "test_fixture=false target_kind=opus-owned-client target_alive=true explicit_descriptor=true capability_authorized=true capture_required=true {summary}"
            ),
        ),
        (CooperativeTargetKind::OpusOwnedClient, AuthorizedTargetOperation::Stop) => (
            "OpusOwnedClientStopProof",
            format!(
                "test_fixture=false target_kind=opus-owned-client explicit_descriptor=true capability_authorized=true clean_target_stop_requested=true capture_required=true {summary}"
            ),
        ),
        (CooperativeTargetKind::OpusOwnedClient, AuthorizedTargetOperation::CloseGame) => (
            "OpusOwnedClientGameCloseProof",
            format!(
                "test_fixture=false target_kind=opus-owned-client explicit_descriptor=true capability_authorized=true cooperative_game_close_requested=true process_signal=false capture_required=true {summary}"
            ),
        ),
    };
    report(operation.phase(), code, message);
    Ok(())
}

fn contract() -> Result<(), InjectorError> {
    report(
        InjectorPhase::Discovery,
        "M3GeneralTargetModel",
        "eligibility=client-independent-minecraft-jvm client_hint=non-authoritative adapter_certification=separate",
    );
    report(
        InjectorPhase::LoadTransport,
        "HandshakeContract",
        format!(
            "protocol_version={} required_fields={}",
            opus_injector::PROTOCOL_VERSION,
            opus_injector::REQUIRED_HANDSHAKE_FIELDS.join(",")
        ),
    );
    report(
        InjectorPhase::LoadTransport,
        "TransportBoundary",
        "request-load uses the reviewed macOS helper only for one explicit current-user Minecraft JVM PID and waits for a capability-bound native runtime handshake; macOS authorization failures remain typed and recoverable",
    );
    report(
        InjectorPhase::LoadTransport,
        "AttachHarnessBoundary",
        "attach-harness uses the JDK Attach API only against the source-controlled OPUS AttachTargetHarness and records a process-instance-bound recovery session; it is diagnostic/test-only, not a production Minecraft transport",
    );
    report(
        InjectorPhase::TargetSelection,
        "JvmAttachCapabilityBoundary",
        "probe-jvm-attach performs only a bounded VM.version capability query against one explicit current-user Minecraft JVM; it never loads an agent and does not select a production transport",
    );
    report(
        InjectorPhase::TargetSelection,
        "LldbDevelopmentBoundary",
        "lldb-harness only probes attach-and-detach availability against the source-controlled OPUS AttachTargetHarness; it is a development lane and never a retail-client fallback",
    );
    report(
        InjectorPhase::LoadTransport,
        "AuthorizedTargetFixtureBoundary",
        "The authorized-target command only talks to the separately launched OPUS loopback test fixture through an explicit descriptor and capability; it is not a third-party-client transport",
    );
    report(
        InjectorPhase::LoadTransport,
        "OpusOwnedClientPreviewBoundary",
        "The opus-owned-client command only talks to the source-controlled OPUS preview bootstrap through its per-session descriptor and capability; it does not select, attach to, or modify arbitrary processes",
    );
    Ok(())
}

fn report(phase: InjectorPhase, code: &'static str, message: impl Into<String>) {
    println!("{}", Diagnostic::new(phase, code, message).render());
}

fn print_usage() {
    println!(
        "Usage:\n\
         opus-injector inspect [--pid <pid>]\n\
         opus-injector runtime-info --runtime <libopus-runtime.dylib>\n\
         opus-injector prepare --pid <pid> --target-architecture <arm64|x86_64> --runtime <libopus-runtime.dylib>\n\
         opus-injector prepare-json --pid <pid> --target-architecture <arm64|x86_64> --runtime <libopus-runtime.dylib>\n\
         opus-injector prepare-auto --pid <pid> --runtime <libopus-runtime.dylib>\n\
         opus-injector request-load --pid <pid> --target-architecture <arm64|x86_64> --runtime <libopus-runtime.dylib> [--transport-helper <opus-macos-transport>]\n\
         opus-injector request-unload --pid <pid>\n\
         opus-injector request-health --pid <pid>\n\
         opus-injector request-stop --pid <pid>\n\
         opus-injector probe-jvm-attach --pid <pid>\n\
         opus-injector probe-native --pid <pid> --target-architecture <arm64|x86_64> [--transport-helper <opus-macos-transport>]\n\
         opus-injector attach-harness load --pid <pid> --target-architecture <arm64|x86_64> --runtime <libopus-runtime.dylib> --attach-classpath <opus-attach-harness.jar|classes-dir> [--attach-java <java>]\n\
         opus-injector attach-harness unload --pid <pid> --attach-classpath <opus-attach-harness.jar|classes-dir> [--attach-java <java>]\n\
         opus-injector lldb-harness probe --pid <pid>\n\
         opus-injector owned-harness --java <java> --classpath <classes-dir> --runtime <libopus-runtime.dylib> --target-architecture <arm64|x86_64> [--cycles <1..20>]\n\
         opus-injector authorized-target load --descriptor <authorized-target.properties> --runtime <libopus-runtime.dylib>\n\
         opus-injector authorized-target unload --descriptor <authorized-target.properties>\n\
         opus-injector authorized-target health --descriptor <authorized-target.properties> [--expect-state <waiting|running|stopped>]\n\
         opus-injector authorized-target stop --descriptor <authorized-target.properties>\n\
         opus-injector opus-owned-client load --descriptor <opus-owned-client.properties> --runtime <libopus-runtime.dylib>\n\
         opus-injector opus-owned-client unload --descriptor <opus-owned-client.properties>\n\
         opus-injector opus-owned-client health --descriptor <opus-owned-client.properties> [--expect-state <waiting|running|stopped>]\n\
         opus-injector opus-owned-client stop --descriptor <opus-owned-client.properties>\n\
         opus-injector opus-owned-client close-game --descriptor <opus-owned-client.properties>\n\
         opus-injector contract"
    );
}

#[cfg(test)]
mod tests {
    use super::{CliCommand, native_backend_availability, parse_cli, target_summary};
    use opus_injector::{
        AuthorizedTargetOperation, CooperativeTargetKind, NativeTransportProbeStatus,
        ProcessSnapshot, TargetArchitecture,
    };

    #[test]
    fn parses_a_preflight_command() {
        let command = parse_cli(vec![
            "prepare".to_owned(),
            "--pid".to_owned(),
            "42".to_owned(),
            "--target-architecture".to_owned(),
            "arm64".to_owned(),
            "--runtime".to_owned(),
            "/tmp/libopus-runtime.dylib".to_owned(),
        ])
        .expect("prepare command should parse");

        assert!(matches!(
            command,
            CliCommand::Prepare {
                pid: 42,
                target_architecture: TargetArchitecture::Arm64,
                ..
            }
        ));
    }

    #[test]
    fn parses_an_automatic_preflight_command() {
        let command = parse_cli(vec![
            "prepare-auto".to_owned(),
            "--pid".to_owned(),
            "42".to_owned(),
            "--runtime".to_owned(),
            "/tmp/libopus-runtime.dylib".to_owned(),
        ])
        .expect("automatic preflight command should parse");

        assert!(matches!(command, CliCommand::PrepareAuto { pid: 42, .. }));
    }

    #[test]
    fn parses_a_native_transport_load_command() {
        let command = parse_cli(vec![
            "request-load".to_owned(),
            "--pid".to_owned(),
            "42".to_owned(),
            "--target-architecture".to_owned(),
            "arm64".to_owned(),
            "--runtime".to_owned(),
            "/tmp/libopus-runtime.dylib".to_owned(),
        ])
        .expect("production load command should parse");

        assert!(matches!(
            command,
            CliCommand::RequestLoad {
                pid: 42,
                target_architecture: TargetArchitecture::Arm64,
                ..
            }
        ));
    }

    #[test]
    fn parses_a_read_only_native_transport_probe() {
        let command = parse_cli(vec![
            "probe-native".to_owned(),
            "--pid".to_owned(),
            "42".to_owned(),
            "--target-architecture".to_owned(),
            "arm64".to_owned(),
        ])
        .expect("native transport probe command should parse");

        assert!(matches!(
            command,
            CliCommand::ProbeNativeTransport {
                pid: 42,
                target_architecture: TargetArchitecture::Arm64,
                ..
            }
        ));
    }

    #[test]
    fn parses_a_benign_jvm_attach_capability_probe() {
        let command = parse_cli(vec![
            "probe-jvm-attach".to_owned(),
            "--pid".to_owned(),
            "42".to_owned(),
        ])
        .expect("JVM Attach capability probe command should parse");

        assert!(matches!(command, CliCommand::ProbeJvmAttach { pid: 42 }));
    }

    #[test]
    fn reports_no_recommended_backend_for_a_task_port_denial() {
        assert_eq!(
            native_backend_availability(NativeTransportProbeStatus::TaskPortDenied),
            (
                "none",
                "UNSUPPORTED_TARGET_CONFIGURATION",
                "no supported instrumentation path is exposed by the selected target configuration",
            )
        );
    }

    #[test]
    fn parses_an_attach_harness_load_command() {
        let command = parse_cli(vec![
            "attach-harness".to_owned(),
            "load".to_owned(),
            "--pid".to_owned(),
            "42".to_owned(),
            "--target-architecture".to_owned(),
            "arm64".to_owned(),
            "--runtime".to_owned(),
            "/tmp/libopus-runtime.dylib".to_owned(),
            "--attach-classpath".to_owned(),
            "/tmp/opus-attach-harness.jar".to_owned(),
        ])
        .expect("JVM Attach load command should parse");

        assert!(matches!(
            command,
            CliCommand::AttachHarnessLoad {
                pid: 42,
                target_architecture: TargetArchitecture::Arm64,
                attach_java,
                ..
            } if attach_java.as_os_str() == std::ffi::OsStr::new("java")
        ));
    }

    #[test]
    fn parses_a_development_only_lldb_harness_probe() {
        let command = parse_cli(vec![
            "lldb-harness".to_owned(),
            "probe".to_owned(),
            "--pid".to_owned(),
            "42".to_owned(),
        ])
        .expect("LLDB harness probe command should parse");

        assert!(matches!(command, CliCommand::LldbHarnessProbe { pid: 42 }));
    }

    #[test]
    fn rejects_duplicate_arguments() {
        let error = parse_cli(vec![
            "inspect".to_owned(),
            "--pid".to_owned(),
            "1".to_owned(),
            "--pid".to_owned(),
            "2".to_owned(),
        ])
        .expect_err("duplicate pid must be rejected");
        assert_eq!(error.code(), "InvalidArguments");
    }

    #[test]
    fn parses_an_owned_harness_command() {
        let command = parse_cli(vec![
            "owned-harness".to_owned(),
            "--java".to_owned(),
            "/tmp/java".to_owned(),
            "--classpath".to_owned(),
            "/tmp/classes".to_owned(),
            "--runtime".to_owned(),
            "/tmp/libopus-runtime.dylib".to_owned(),
            "--target-architecture".to_owned(),
            "x86_64".to_owned(),
            "--cycles".to_owned(),
            "3".to_owned(),
        ])
        .expect("owned harness command should parse");

        assert!(matches!(
            command,
            CliCommand::OwnedHarness {
                target_architecture: TargetArchitecture::X86_64,
                cycles: 3,
                ..
            }
        ));
    }

    #[test]
    fn rejects_a_non_numeric_owned_harness_cycle_count() {
        let error = parse_cli(vec![
            "owned-harness".to_owned(),
            "--java".to_owned(),
            "/tmp/java".to_owned(),
            "--classpath".to_owned(),
            "/tmp/classes".to_owned(),
            "--runtime".to_owned(),
            "/tmp/libopus-runtime.dylib".to_owned(),
            "--target-architecture".to_owned(),
            "arm64".to_owned(),
            "--cycles".to_owned(),
            "many".to_owned(),
        ])
        .expect_err("non-numeric cycle count must be rejected");
        assert_eq!(error.code(), "InvalidArguments");
    }

    #[test]
    fn parses_an_authorized_target_health_command() {
        let command = parse_cli(vec![
            "authorized-target".to_owned(),
            "health".to_owned(),
            "--descriptor".to_owned(),
            "/tmp/authorized-target.properties".to_owned(),
            "--expect-state".to_owned(),
            "stopped".to_owned(),
        ])
        .expect("authorized target health command should parse");

        assert!(matches!(
            command,
            CliCommand::CooperativeTarget {
                target_kind: CooperativeTargetKind::AuthorizedTestHarness,
                operation: AuthorizedTargetOperation::Health,
                expected_state: Some(ref state),
                ..
            } if state == "stopped"
        ));
    }

    #[test]
    fn rejects_runtime_for_authorized_target_unload() {
        let error = parse_cli(vec![
            "authorized-target".to_owned(),
            "unload".to_owned(),
            "--descriptor".to_owned(),
            "/tmp/authorized-target.properties".to_owned(),
            "--runtime".to_owned(),
            "/tmp/libopus-runtime.dylib".to_owned(),
        ])
        .expect_err("unload must reject a runtime path");
        assert_eq!(error.code(), "InvalidArguments");
    }

    #[test]
    fn parses_an_opus_owned_client_health_command() {
        let command = parse_cli(vec![
            "opus-owned-client".to_owned(),
            "health".to_owned(),
            "--descriptor".to_owned(),
            "/tmp/opus-owned-client.properties".to_owned(),
            "--expect-state".to_owned(),
            "running".to_owned(),
        ])
        .expect("OPUS-owned client health command should parse");

        assert!(matches!(
            command,
            CliCommand::CooperativeTarget {
                target_kind: CooperativeTargetKind::OpusOwnedClient,
                operation: AuthorizedTargetOperation::Health,
                expected_state: Some(ref state),
                ..
            } if state == "running"
        ));
    }

    #[test]
    fn parses_an_opus_owned_client_game_close_command() {
        let command = parse_cli(vec![
            "opus-owned-client".to_owned(),
            "close-game".to_owned(),
            "--descriptor".to_owned(),
            "/tmp/opus-owned-client.properties".to_owned(),
        ])
        .expect("OPUS-owned close-game command should parse");

        assert!(matches!(
            command,
            CliCommand::CooperativeTarget {
                target_kind: CooperativeTargetKind::OpusOwnedClient,
                operation: AuthorizedTargetOperation::CloseGame,
                ..
            }
        ));
    }

    #[test]
    fn rejects_an_authorized_target_game_close_command() {
        let error = parse_cli(vec![
            "authorized-target".to_owned(),
            "close-game".to_owned(),
            "--descriptor".to_owned(),
            "/tmp/authorized-target.properties".to_owned(),
        ])
        .expect_err("test harness must not accept a game-close command");
        assert_eq!(error.code(), "InvalidArguments");
    }

    #[test]
    fn target_summary_does_not_render_raw_jvm_arguments() {
        let target = ProcessSnapshot {
            pid: 42,
            parent_pid: 1,
            owner_uid: Some(501),
            executable: "/Applications/Example Client/bin/java".to_owned(),
            command_line: "/Applications/Example Client/bin/java --sessionToken=never-rendered net.minecraft.client.main.Main".to_owned(),
            start_time: None,
        };

        let summary = target_summary(&target, 501);
        assert_eq!(
            summary,
            "pid=42 parent_pid=1 executable=java minecraft_jvm_candidate=true target_ownership=current-user client_hint=vanilla candidate_evidence=minecraft-main-class,minecraft-runtime-marker"
        );
        assert!(!summary.contains("sessionToken"));
        assert!(!summary.contains("never-rendered"));
    }
}
