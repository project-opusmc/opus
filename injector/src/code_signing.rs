use std::path::Path;
use std::process::Command;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CodeSigningStatus {
    Signed,
    Unsigned,
    Unavailable,
}

impl CodeSigningStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Signed => "signed",
            Self::Unsigned => "unsigned",
            Self::Unavailable => "unavailable",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CodeSigningObservation {
    Present,
    Absent,
    Unknown,
}

impl CodeSigningObservation {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Present => "present",
            Self::Absent => "absent",
            Self::Unknown => "unknown",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CodeSigningReport {
    pub status: CodeSigningStatus,
    pub hardened_runtime: CodeSigningObservation,
    pub get_task_allow: CodeSigningObservation,
    pub team_identifier: CodeSigningObservation,
}

impl CodeSigningReport {
    pub fn summary(&self) -> String {
        format!(
            "code_signature={} hardened_runtime={} get_task_allow={} team_identifier={} task_port_authorization=not-inferred",
            self.status.as_str(),
            self.hardened_runtime.as_str(),
            self.get_task_allow.as_str(),
            self.team_identifier.as_str(),
        )
    }

    fn unavailable(status: CodeSigningStatus) -> Self {
        Self {
            status,
            hardened_runtime: CodeSigningObservation::Unknown,
            get_task_allow: CodeSigningObservation::Unknown,
            team_identifier: CodeSigningObservation::Unknown,
        }
    }
}

#[derive(Clone, Copy, Debug, Default)]
pub struct CodeSignInspector;

impl CodeSignInspector {
    pub fn inspect(self, executable: &Path) -> CodeSigningReport {
        let output = Command::new("/usr/bin/codesign")
            .args(["-d", "--verbose=4", "--entitlements", ":-"])
            .arg(executable)
            .output();
        match output {
            Ok(output) => parse_codesign_output(output.status.success(), &combined_output(&output)),
            Err(_) => CodeSigningReport::unavailable(CodeSigningStatus::Unavailable),
        }
    }
}

fn combined_output(output: &std::process::Output) -> String {
    format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    )
}

fn parse_codesign_output(success: bool, output: &str) -> CodeSigningReport {
    if !success {
        if output.contains("code object is not signed at all")
            || output.contains("is not signed")
            || output.contains("not signed at all")
        {
            return CodeSigningReport::unavailable(CodeSigningStatus::Unsigned);
        }
        return CodeSigningReport::unavailable(CodeSigningStatus::Unavailable);
    }

    CodeSigningReport {
        status: CodeSigningStatus::Signed,
        hardened_runtime: hardened_runtime_observation(output),
        get_task_allow: get_task_allow_observation(output),
        team_identifier: team_identifier_observation(output),
    }
}

fn hardened_runtime_observation(output: &str) -> CodeSigningObservation {
    let Some(code_directory) = output
        .lines()
        .find(|line| line.trim_start().starts_with("CodeDirectory "))
    else {
        return CodeSigningObservation::Unknown;
    };
    if code_directory.contains("(runtime") || code_directory.contains(",runtime") {
        CodeSigningObservation::Present
    } else {
        CodeSigningObservation::Absent
    }
}

fn get_task_allow_observation(output: &str) -> CodeSigningObservation {
    let Some(entitlement_start) = output.find("<key>com.apple.security.get-task-allow</key>")
    else {
        return CodeSigningObservation::Absent;
    };
    let entitlement_value = &output[entitlement_start..];
    if entitlement_value.contains("<true") {
        CodeSigningObservation::Present
    } else if entitlement_value.contains("<false") {
        CodeSigningObservation::Absent
    } else {
        CodeSigningObservation::Unknown
    }
}

fn team_identifier_observation(output: &str) -> CodeSigningObservation {
    let Some(team_identifier) = output
        .lines()
        .find_map(|line| line.trim_start().strip_prefix("TeamIdentifier="))
    else {
        return CodeSigningObservation::Unknown;
    };
    if team_identifier.trim().eq_ignore_ascii_case("not set") {
        CodeSigningObservation::Absent
    } else if team_identifier.trim().is_empty() {
        CodeSigningObservation::Unknown
    } else {
        CodeSigningObservation::Present
    }
}

#[cfg(test)]
mod tests {
    use super::{CodeSigningObservation, CodeSigningStatus, parse_codesign_output};

    #[test]
    fn parses_an_adhoc_debug_signature_with_get_task_allow() {
        let report = parse_codesign_output(
            true,
            concat!(
                "CodeDirectory v=20400 size=509 flags=0x2(adhoc) hashes=4+7 location=embedded\n",
                "Signature=adhoc\n",
                "TeamIdentifier=not set\n",
                "<plist><dict><key>com.apple.security.get-task-allow</key><true/></dict></plist>\n"
            ),
        );

        assert_eq!(report.status, CodeSigningStatus::Signed);
        assert_eq!(report.hardened_runtime, CodeSigningObservation::Absent);
        assert_eq!(report.get_task_allow, CodeSigningObservation::Present);
        assert_eq!(report.team_identifier, CodeSigningObservation::Absent);
        assert!(
            report
                .summary()
                .contains("task_port_authorization=not-inferred")
        );
    }

    #[test]
    fn parses_a_hardened_signature_without_get_task_allow() {
        let report = parse_codesign_output(
            true,
            concat!(
                "CodeDirectory v=20400 size=509 flags=0x10000(runtime) hashes=4+7 location=embedded\n",
                "TeamIdentifier=TDTHCUPYFR\n",
                "<plist><dict><key>com.apple.security.device.audio-input</key><true/></dict></plist>\n"
            ),
        );

        assert_eq!(report.status, CodeSigningStatus::Signed);
        assert_eq!(report.hardened_runtime, CodeSigningObservation::Present);
        assert_eq!(report.get_task_allow, CodeSigningObservation::Absent);
        assert_eq!(report.team_identifier, CodeSigningObservation::Present);
    }

    #[test]
    fn preserves_an_unsigned_result_without_guessing_capabilities() {
        let report = parse_codesign_output(false, "codesign: code object is not signed at all\n");

        assert_eq!(report.status, CodeSigningStatus::Unsigned);
        assert_eq!(report.hardened_runtime, CodeSigningObservation::Unknown);
        assert_eq!(report.get_task_allow, CodeSigningObservation::Unknown);
        assert_eq!(report.team_identifier, CodeSigningObservation::Unknown);
    }
}
