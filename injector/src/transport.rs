use crate::architecture::{
    TargetArchitecture, format_architectures, validate_runtime_architecture,
};
use crate::diagnostics::InjectorError;
use crate::process::{
    ClientHint, MinecraftJvmCandidate, MinecraftJvmEvidence, ProcessSnapshot,
    find_owned_minecraft_jvm_candidate,
};
use std::collections::BTreeSet;

pub const PROTOCOL_VERSION: u32 = 1;
pub const FOUNDATION_JAVA_RUNTIME_VERSION: &str = "not-built";
pub const FOUNDATION_MAPPING_SCHEMA_VERSION: &str = "not-applicable";
pub const FOUNDATION_ONECONFIG_ADAPTER_VERSION: &str = "not-loaded";
pub const FOUNDATION_ARTIFACT_CHECKSUMS: &str = "not-packaged";
pub const REQUIRED_HANDSHAKE_FIELDS: &[&str] = &[
    "protocolVersion",
    "injectorVersion",
    "nativeRuntimeVersion",
    "javaRuntimeVersion",
    "targetArchitecture",
    "mappingSchemaVersion",
    "oneConfigAdapterVersion",
    "artifactChecksums",
];

pub const REQUIRED_CONTROL_OPERATIONS: &[&str] = &["load", "unload", "health", "stop"];

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TransportContract {
    pub protocol_version: u32,
    pub target_architecture_aliases: &'static [&'static str],
    pub required_handshake_fields: &'static [&'static str],
    pub required_control_operations: &'static [&'static str],
    pub handshake_json_shape: &'static str,
}

impl TransportContract {
    pub fn current() -> Self {
        Self {
            protocol_version: PROTOCOL_VERSION,
            target_architecture_aliases: &["amd64", "x86_64", "aarch64", "arm64"],
            required_handshake_fields: REQUIRED_HANDSHAKE_FIELDS,
            required_control_operations: REQUIRED_CONTROL_OPERATIONS,
            handshake_json_shape: concat!(
                "{",
                "\"protocolVersion\":u32,",
                "\"injectorVersion\":string,",
                "\"nativeRuntimeVersion\":string,",
                "\"javaRuntimeVersion\":string,",
                "\"targetArchitecture\":\"arm64|x86_64\",",
                "\"mappingSchemaVersion\":string,",
                "\"oneConfigAdapterVersion\":string,",
                "\"artifactChecksums\":string",
                "}"
            ),
        }
    }

    pub fn render_json(&self) -> String {
        format!(
            concat!(
                "{{",
                "\"protocolVersion\":{},",
                "\"targetArchitectureAliases\":[{}],",
                "\"requiredHandshakeFields\":[{}],",
                "\"requiredControlOperations\":[{}],",
                "\"handshakeJsonShape\":\"{}\"",
                "}}"
            ),
            self.protocol_version,
            self.target_architecture_aliases
                .iter()
                .map(|alias| format!("\"{}\"", json_escape(alias)))
                .collect::<Vec<_>>()
                .join(","),
            self.required_handshake_fields
                .iter()
                .map(|field| format!("\"{}\"", json_escape(field)))
                .collect::<Vec<_>>()
                .join(","),
            self.required_control_operations
                .iter()
                .map(|operation| format!("\"{}\"", json_escape(operation)))
                .collect::<Vec<_>>()
                .join(","),
            json_escape(self.handshake_json_shape),
        )
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VersionHandshake {
    pub protocol_version: u32,
    pub injector_version: String,
    pub native_runtime_version: String,
    pub java_runtime_version: String,
    pub target_architecture: TargetArchitecture,
    pub mapping_schema_version: String,
    pub oneconfig_adapter_version: String,
    pub artifact_checksums: String,
}

impl VersionHandshake {
    pub fn validate_for(
        &self,
        expected_target_architecture: TargetArchitecture,
    ) -> Result<(), InjectorError> {
        if self.protocol_version != PROTOCOL_VERSION {
            return Err(InjectorError::HandshakeProtocolMismatch {
                expected: PROTOCOL_VERSION,
                actual: self.protocol_version,
            });
        }
        if self.target_architecture != expected_target_architecture {
            return Err(InjectorError::HandshakeArchitectureMismatch {
                expected: expected_target_architecture,
                actual: self.target_architecture,
            });
        }
        for (field, value) in [
            ("injectorVersion", self.injector_version.as_str()),
            ("nativeRuntimeVersion", self.native_runtime_version.as_str()),
            ("javaRuntimeVersion", self.java_runtime_version.as_str()),
            ("mappingSchemaVersion", self.mapping_schema_version.as_str()),
            (
                "oneConfigAdapterVersion",
                self.oneconfig_adapter_version.as_str(),
            ),
            ("artifactChecksums", self.artifact_checksums.as_str()),
        ] {
            if value.trim().is_empty() {
                return Err(InjectorError::HandshakeMissingField { field });
            }
        }
        Ok(())
    }
}

pub fn validate_foundation_handshake(
    handshake: &VersionHandshake,
    expected_target_architecture: TargetArchitecture,
) -> Result<(), InjectorError> {
    handshake.validate_for(expected_target_architecture)?;
    validate_handshake_value(
        "injector",
        &handshake.injector_version,
        env!("CARGO_PKG_VERSION"),
    )?;
    validate_handshake_value(
        "native-runtime",
        &handshake.native_runtime_version,
        env!("CARGO_PKG_VERSION"),
    )?;
    validate_handshake_value(
        "java-runtime",
        &handshake.java_runtime_version,
        FOUNDATION_JAVA_RUNTIME_VERSION,
    )?;
    validate_handshake_value(
        "mapping-schema",
        &handshake.mapping_schema_version,
        FOUNDATION_MAPPING_SCHEMA_VERSION,
    )?;
    validate_handshake_value(
        "oneconfig-adapter",
        &handshake.oneconfig_adapter_version,
        FOUNDATION_ONECONFIG_ADAPTER_VERSION,
    )?;
    validate_handshake_value(
        "artifacts",
        &handshake.artifact_checksums,
        FOUNDATION_ARTIFACT_CHECKSUMS,
    )?;
    Ok(())
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LoadPreparation {
    pub target: MinecraftJvmCandidate,
    pub declared_target_architecture: TargetArchitecture,
    pub runtime_architectures: BTreeSet<TargetArchitecture>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PreflightReport {
    pub pid: u32,
    pub target_executable: String,
    pub target_ownership: &'static str,
    pub client_hint: ClientHint,
    pub candidate_evidence: Vec<MinecraftJvmEvidence>,
    pub declared_target_architecture: TargetArchitecture,
    pub runtime_architectures: BTreeSet<TargetArchitecture>,
    pub protocol_version: u32,
    pub required_handshake_fields: &'static [&'static str],
}

impl LoadPreparation {
    pub fn summary(&self) -> String {
        format!(
            "pid={} target_ownership=current-user client_hint={} candidate_evidence={} target_architecture={} runtime_architectures={}",
            self.target.process.pid,
            self.target.client_hint,
            self.target.evidence_summary(),
            self.declared_target_architecture,
            format_architectures(&self.runtime_architectures)
        )
    }
}

impl PreflightReport {
    pub fn from_preparation(preparation: &LoadPreparation) -> Self {
        Self {
            pid: preparation.target.process.pid,
            target_executable: preparation.target.process.executable_name().to_owned(),
            target_ownership: "current-user",
            client_hint: preparation.target.client_hint,
            candidate_evidence: preparation.target.evidence.clone(),
            declared_target_architecture: preparation.declared_target_architecture,
            runtime_architectures: preparation.runtime_architectures.clone(),
            protocol_version: PROTOCOL_VERSION,
            required_handshake_fields: REQUIRED_HANDSHAKE_FIELDS,
        }
    }

    pub fn render(&self) -> String {
        format!(
            concat!(
                "[OPUS/INJECTOR] phase=load-transport code=PreflightReport ",
                "pid={} target_ownership={} client_hint={} candidate_evidence={} target_architecture={} runtime_architectures={} protocol_version={} required_fields={}",
                " executable={}"
            ),
            self.pid,
            self.target_ownership,
            self.client_hint,
            self.candidate_evidence
                .iter()
                .map(ToString::to_string)
                .collect::<Vec<_>>()
                .join(","),
            self.declared_target_architecture,
            format_architectures(&self.runtime_architectures),
            self.protocol_version,
            self.required_handshake_fields.join(","),
            self.target_executable,
        )
    }

    pub fn render_json(&self) -> String {
        format!(
            concat!(
                "{{",
                "\"phase\":\"load-transport\",",
                "\"code\":\"PreflightReport\",",
                "\"pid\":{},",
                "\"targetOwnership\":\"{}\",",
                "\"clientHint\":\"{}\",",
                "\"candidateEvidence\":[{}],",
                "\"targetArchitecture\":\"{}\",",
                "\"runtimeArchitectures\":[{}],",
                "\"protocolVersion\":{},",
                "\"requiredHandshakeFields\":[{}],",
                "\"executable\":\"{}\"",
                "}}"
            ),
            self.pid,
            self.target_ownership,
            self.client_hint,
            self.candidate_evidence
                .iter()
                .map(|evidence| format!("\"{}\"", evidence))
                .collect::<Vec<_>>()
                .join(","),
            self.declared_target_architecture,
            self.runtime_architectures
                .iter()
                .map(|arch| format!("\"{}\"", arch))
                .collect::<Vec<_>>()
                .join(","),
            self.protocol_version,
            self.required_handshake_fields
                .iter()
                .map(|field| format!("\"{}\"", json_escape(field)))
                .collect::<Vec<_>>()
                .join(","),
            json_escape(&self.target_executable),
        )
    }
}

pub fn prepare_load(
    processes: &[ProcessSnapshot],
    pid: u32,
    current_user_id: u32,
    declared_target_architecture: TargetArchitecture,
    runtime_architectures: BTreeSet<TargetArchitecture>,
) -> Result<LoadPreparation, InjectorError> {
    let target = find_owned_minecraft_jvm_candidate(processes, pid, current_user_id)?;
    validate_runtime_architecture(declared_target_architecture, &runtime_architectures)?;

    Ok(LoadPreparation {
        target,
        declared_target_architecture,
        runtime_architectures,
    })
}

pub fn render_preflight_report(preparation: &LoadPreparation) -> String {
    PreflightReport::from_preparation(preparation).render()
}

pub fn render_preflight_report_json(preparation: &LoadPreparation) -> String {
    PreflightReport::from_preparation(preparation).render_json()
}

pub fn render_transport_contract_json() -> String {
    TransportContract::current().render_json()
}

fn json_escape(value: &str) -> String {
    let mut escaped = String::with_capacity(value.len());
    for character in value.chars() {
        match character {
            '"' => escaped.push_str("\\\""),
            '\\' => escaped.push_str("\\\\"),
            '\n' => escaped.push_str("\\n"),
            '\r' => escaped.push_str("\\r"),
            '\t' => escaped.push_str("\\t"),
            character if character.is_control() => escaped.push(' '),
            character => escaped.push(character),
        }
    }
    escaped
}

fn validate_handshake_value(
    component: &'static str,
    actual: &str,
    expected: &str,
) -> Result<(), InjectorError> {
    if actual == expected {
        return Ok(());
    }
    Err(InjectorError::HandshakeVersionMismatch {
        component,
        expected: expected.to_owned(),
        actual: actual.to_owned(),
    })
}

#[cfg(test)]
mod tests {
    use super::{
        TransportContract, VersionHandshake, prepare_load, render_preflight_report,
        render_preflight_report_json, render_transport_contract_json,
        validate_foundation_handshake,
    };
    use crate::architecture::TargetArchitecture;
    use crate::diagnostics::InjectorError;
    use crate::process::ProcessSnapshot;
    use std::collections::BTreeSet;

    fn candidate() -> ProcessSnapshot {
        ProcessSnapshot {
            pid: 42,
            parent_pid: 1,
            owner_uid: Some(501),
            executable: "/usr/bin/java".to_owned(),
            command_line:
                "/usr/bin/java --sessionToken=never-rendered net.minecraft.client.main.Main"
                    .to_owned(),
            start_time: None,
        }
    }

    #[test]
    fn prepares_a_same_architecture_candidate() {
        let preparation = prepare_load(
            &[candidate()],
            42,
            501,
            TargetArchitecture::Arm64,
            BTreeSet::from([TargetArchitecture::Arm64]),
        )
        .expect("same-architecture candidate should pass preflight");
        assert_eq!(preparation.target.process.pid, 42);
    }

    #[test]
    fn prepares_an_unknown_minecraft_jvm_without_a_client_brand() {
        let unknown_minecraft_jvm = ProcessSnapshot {
            pid: 43,
            parent_pid: 1,
            owner_uid: Some(501),
            executable: "/usr/bin/java".to_owned(),
            command_line:
                "/usr/bin/java -Dgame.directory=/Users/example/.minecraft --version 1.8.9 custom.bootstrap.Main".to_owned(),
            start_time: None,
        };

        let preparation = prepare_load(
            &[unknown_minecraft_jvm],
            43,
            501,
            TargetArchitecture::Arm64,
            BTreeSet::from([TargetArchitecture::Arm64]),
        )
        .expect("an explicitly selected Minecraft JVM must not require a client brand");

        assert_eq!(
            preparation.target.client_hint.to_string(),
            "unknown",
            "the target model must preserve an unknown client hint"
        );
        assert_eq!(
            preparation.target.evidence_summary(),
            "game-directory-marker,minecraft-189-version-marker"
        );
    }

    #[test]
    fn rejects_a_handshake_for_the_wrong_architecture() {
        let handshake = VersionHandshake {
            protocol_version: 1,
            injector_version: "0.1.0".to_owned(),
            native_runtime_version: "0.1.0".to_owned(),
            java_runtime_version: "not-built".to_owned(),
            target_architecture: TargetArchitecture::X86_64,
            mapping_schema_version: "1".to_owned(),
            oneconfig_adapter_version: "1".to_owned(),
            artifact_checksums: "fixture".to_owned(),
        };

        let error = handshake
            .validate_for(TargetArchitecture::Arm64)
            .expect_err("handshake architecture must agree with the selected target");
        assert!(matches!(
            error,
            InjectorError::HandshakeArchitectureMismatch { .. }
        ));
    }

    #[test]
    fn renders_a_preflight_report() {
        let preparation = prepare_load(
            &[candidate()],
            42,
            501,
            TargetArchitecture::Arm64,
            BTreeSet::from([TargetArchitecture::Arm64]),
        )
        .expect("same-architecture candidate should pass preflight");

        let report = render_preflight_report(&preparation);
        assert!(report.contains("code=PreflightReport"));
        assert!(report.contains("protocol_version=1"));
        assert!(report.contains("target_ownership=current-user"));
        assert!(report.contains("client_hint=vanilla"));
        assert!(
            report.contains("candidate_evidence=minecraft-main-class,minecraft-runtime-marker")
        );
        assert!(report.contains("executable=java"));
        assert!(!report.contains("net.minecraft.client.main.Main"));
        assert!(!report.contains("sessionToken"));
        assert!(!report.contains("never-rendered"));
        assert!(report.contains("required_fields=protocolVersion,injectorVersion,nativeRuntimeVersion,javaRuntimeVersion,targetArchitecture,mappingSchemaVersion,oneConfigAdapterVersion,artifactChecksums"));
    }

    #[test]
    fn renders_a_json_preflight_report() {
        let preparation = prepare_load(
            &[candidate()],
            42,
            501,
            TargetArchitecture::Arm64,
            BTreeSet::from([TargetArchitecture::Arm64]),
        )
        .expect("same-architecture candidate should pass preflight");

        let report = render_preflight_report_json(&preparation);
        assert!(report.contains("\"phase\":\"load-transport\""));
        assert!(report.contains("\"targetOwnership\":\"current-user\""));
        assert!(report.contains("\"clientHint\":\"vanilla\""));
        assert!(report.contains(
            "\"candidateEvidence\":[\"minecraft-main-class\",\"minecraft-runtime-marker\"]"
        ));
        assert!(report.contains("\"targetArchitecture\":\"arm64\""));
        assert!(report.contains("\"protocolVersion\":1"));
        assert!(report.contains("\"executable\":\"java\""));
        assert!(!report.contains("sessionToken"));
        assert!(!report.contains("never-rendered"));
    }

    #[test]
    fn renders_a_transport_contract() {
        let contract = TransportContract::current();
        let json = contract.render_json();
        assert!(json.contains("\"protocolVersion\":1"));
        assert!(
            json.contains(
                "\"requiredControlOperations\":[\"load\",\"unload\",\"health\",\"stop\"]"
            )
        );

        let exported = render_transport_contract_json();
        assert!(exported.contains("\"handshakeJsonShape\""));
    }

    #[test]
    fn accepts_the_current_foundation_handshake() {
        let handshake = VersionHandshake {
            protocol_version: 1,
            injector_version: "0.1.0".to_owned(),
            native_runtime_version: "0.1.0".to_owned(),
            java_runtime_version: "not-built".to_owned(),
            target_architecture: TargetArchitecture::Arm64,
            mapping_schema_version: "not-applicable".to_owned(),
            oneconfig_adapter_version: "not-loaded".to_owned(),
            artifact_checksums: "not-packaged".to_owned(),
        };

        validate_foundation_handshake(&handshake, TargetArchitecture::Arm64)
            .expect("current foundation handshake should validate");
    }

    #[test]
    fn rejects_a_preflight_target_owned_by_another_user() {
        let foreign_candidate = ProcessSnapshot {
            pid: 44,
            parent_pid: 1,
            owner_uid: Some(502),
            executable: "/usr/bin/java".to_owned(),
            command_line: "/usr/bin/java net.minecraft.client.main.Main".to_owned(),
            start_time: None,
        };

        let error = prepare_load(
            &[foreign_candidate],
            44,
            501,
            TargetArchitecture::Arm64,
            BTreeSet::from([TargetArchitecture::Arm64]),
        )
        .expect_err("preflight must not prepare a process owned by another user");

        assert_eq!(error.code(), "TargetOwnershipMismatch");
    }
}
