#![forbid(unsafe_code)]

pub mod architecture;
pub mod authorized_target;
pub mod code_signing;
pub mod diagnostics;
pub mod jvm_attach;
pub mod jvm_attach_probe;
pub mod lldb_development;
pub mod native_transport;
pub mod owned_target;
pub mod process;
pub mod transport;

pub use architecture::{
    TargetArchitecture, format_architectures, inspect_executable_architectures,
    inspect_runtime_architectures, select_thin_executable_architecture,
    validate_runtime_architecture,
};
pub use authorized_target::{
    AUTHORIZED_TARGET_KIND, AuthorizedTargetDescriptor, AuthorizedTargetOperation,
    AuthorizedTargetReport, CooperativeTargetKind, OPUS_OWNED_CLIENT_KIND,
    request_authorized_target, request_opus_owned_client,
};
pub use code_signing::{
    CodeSignInspector, CodeSigningObservation, CodeSigningReport, CodeSigningStatus,
};
pub use diagnostics::{Diagnostic, InjectorError, InjectorPhase, diagnostic_for};
pub use jvm_attach::{
    ATTACH_HARNESS_HELPER_MAIN_CLASS, JvmAttachConfig, JvmAttachOperation, JvmAttachReport,
    request_jvm_attach_harness_load, request_jvm_attach_harness_unload,
};
pub use jvm_attach_probe::{
    JvmAttachProbeReport, JvmAttachProbeStatus, probe_jvm_attach_capability,
};
pub use lldb_development::{
    LldbDevelopmentReport, LldbDevelopmentStatus, probe_lldb_development_harness,
};
pub use native_transport::{
    NATIVE_TRANSPORT_HELPER_ENV, NATIVE_TRANSPORT_KIND, NativeTransportOperation,
    NativeTransportProbeReport, NativeTransportProbeStatus, NativeTransportReport,
    probe_native_transport, request_native_transport_health, request_native_transport_load,
    request_native_transport_stop, request_native_transport_unload,
};
pub use owned_target::{
    OwnedTargetConfig, OwnedTargetReport, exercise_owned_target, report_summary,
};
pub use process::{
    ClientHint, MinecraftJvmCandidate, MinecraftJvmEvidence, ProcessInstanceIdentity,
    ProcessSnapshot, TargetOwnership, candidate_processes, current_user_id,
    find_minecraft_jvm_candidate, find_owned_attach_harness, find_owned_minecraft_jvm_candidate,
    find_process, inspect_system_processes, lunar_launcher_processes, minecraft_jvm_candidates,
    parse_ps_output, parse_ps_output_with_owner, require_current_user_ownership,
};
pub use transport::{
    FOUNDATION_ARTIFACT_CHECKSUMS, FOUNDATION_JAVA_RUNTIME_VERSION,
    FOUNDATION_MAPPING_SCHEMA_VERSION, FOUNDATION_ONECONFIG_ADAPTER_VERSION, LoadPreparation,
    PROTOCOL_VERSION, REQUIRED_CONTROL_OPERATIONS, REQUIRED_HANDSHAKE_FIELDS, TransportContract,
    VersionHandshake, prepare_load, render_preflight_report, render_preflight_report_json,
    render_transport_contract_json, validate_foundation_handshake,
};
