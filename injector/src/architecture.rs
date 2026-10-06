use crate::diagnostics::InjectorError;
use std::collections::BTreeSet;
use std::fmt::{Display, Formatter};
use std::path::Path;
use std::process::Command;

#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub enum TargetArchitecture {
    Arm64,
    X86_64,
}

impl TargetArchitecture {
    pub fn parse(value: &str) -> Result<Self, InjectorError> {
        match value.trim().to_ascii_lowercase().as_str() {
            "arm64" | "aarch64" => Ok(Self::Arm64),
            "x86_64" | "amd64" => Ok(Self::X86_64),
            _ => Err(InjectorError::InvalidArchitecture {
                value: value.to_owned(),
            }),
        }
    }
}

impl Display for TargetArchitecture {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Arm64 => formatter.write_str("arm64"),
            Self::X86_64 => formatter.write_str("x86_64"),
        }
    }
}

pub fn format_architectures(architectures: &BTreeSet<TargetArchitecture>) -> String {
    architectures
        .iter()
        .map(ToString::to_string)
        .collect::<Vec<_>>()
        .join(",")
}

pub fn parse_macho_architectures(output: &str) -> BTreeSet<TargetArchitecture> {
    output
        .split(|character: char| !character.is_ascii_alphanumeric() && character != '_')
        .filter_map(|token| match token.to_ascii_lowercase().as_str() {
            "arm64" | "arm64e" | "aarch64" => Some(TargetArchitecture::Arm64),
            "x86_64" | "amd64" => Some(TargetArchitecture::X86_64),
            _ => None,
        })
        .collect()
}

pub fn inspect_runtime_architectures(
    runtime_path: &Path,
) -> Result<BTreeSet<TargetArchitecture>, InjectorError> {
    if !runtime_path.is_file() {
        return Err(InjectorError::RuntimeArtifactMissing {
            path: runtime_path.to_path_buf(),
        });
    }

    inspect_macho_architectures(runtime_path).map_err(|error| match error {
        MachOInspectionError::InspectionFailed { detail } => {
            InjectorError::RuntimeInspectionFailed {
                path: runtime_path.to_path_buf(),
                detail,
            }
        }
        MachOInspectionError::ArchitectureUnreadable { output } => {
            InjectorError::RuntimeArchitectureUnreadable {
                path: runtime_path.to_path_buf(),
                output,
            }
        }
    })
}

pub fn inspect_executable_architectures(
    executable_path: &Path,
) -> Result<BTreeSet<TargetArchitecture>, InjectorError> {
    if !executable_path.is_file() {
        return Err(InjectorError::TargetExecutableMissing {
            path: executable_path.to_path_buf(),
        });
    }

    inspect_macho_architectures(executable_path).map_err(|error| match error {
        MachOInspectionError::InspectionFailed { detail } => {
            InjectorError::TargetExecutableInspectionFailed {
                path: executable_path.to_path_buf(),
                detail,
            }
        }
        MachOInspectionError::ArchitectureUnreadable { output } => {
            InjectorError::TargetExecutableArchitectureUnreadable {
                path: executable_path.to_path_buf(),
                output,
            }
        }
    })
}

pub fn select_thin_executable_architecture(
    executable_architectures: &BTreeSet<TargetArchitecture>,
) -> Result<TargetArchitecture, InjectorError> {
    if executable_architectures.len() != 1 {
        return Err(InjectorError::TargetArchitectureNotSingle {
            executable_architectures: executable_architectures.clone(),
        });
    }

    Ok(*executable_architectures
        .iter()
        .next()
        .expect("a single executable architecture must exist"))
}

enum MachOInspectionError {
    InspectionFailed { detail: String },
    ArchitectureUnreadable { output: String },
}

fn inspect_macho_architectures(
    path: &Path,
) -> Result<BTreeSet<TargetArchitecture>, MachOInspectionError> {
    let output = Command::new("lipo")
        .arg("-archs")
        .arg(path)
        .output()
        .map_err(|error| MachOInspectionError::InspectionFailed {
            detail: error.to_string(),
        })?;
    if !output.status.success() {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        return Err(MachOInspectionError::InspectionFailed {
            detail: if detail.is_empty() {
                format!("lipo exited with {}", output.status)
            } else {
                detail
            },
        });
    }

    let architectures = parse_macho_architectures(&String::from_utf8_lossy(&output.stdout));
    if architectures.is_empty() {
        return Err(MachOInspectionError::ArchitectureUnreadable {
            output: String::from_utf8_lossy(&output.stdout).trim().to_owned(),
        });
    }
    Ok(architectures)
}

pub fn validate_runtime_architecture(
    target_architecture: TargetArchitecture,
    runtime_architectures: &BTreeSet<TargetArchitecture>,
) -> Result<(), InjectorError> {
    if runtime_architectures.contains(&target_architecture) {
        Ok(())
    } else {
        Err(InjectorError::ArchitectureMismatch {
            target_architecture,
            runtime_architectures: runtime_architectures.clone(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::{
        TargetArchitecture, parse_macho_architectures, select_thin_executable_architecture,
        validate_runtime_architecture,
    };
    use crate::diagnostics::InjectorError;
    use std::collections::BTreeSet;

    #[test]
    fn normalizes_architecture_aliases() {
        assert_eq!(
            TargetArchitecture::parse("aarch64").expect("aarch64 should parse"),
            TargetArchitecture::Arm64
        );
        assert_eq!(
            TargetArchitecture::parse("amd64").expect("amd64 should parse"),
            TargetArchitecture::X86_64
        );
    }

    #[test]
    fn parses_both_macho_slices() {
        let architectures = parse_macho_architectures("arm64 x86_64");
        assert_eq!(architectures.len(), 2);
        assert!(architectures.contains(&TargetArchitecture::Arm64));
        assert!(architectures.contains(&TargetArchitecture::X86_64));
    }

    #[test]
    fn rejects_a_mismatched_runtime_slice() {
        let architectures = BTreeSet::from([TargetArchitecture::Arm64]);
        let error = validate_runtime_architecture(TargetArchitecture::X86_64, &architectures)
            .expect_err("an arm64 dylib cannot load into an x86_64 JVM");
        assert!(matches!(error, InjectorError::ArchitectureMismatch { .. }));
    }

    #[test]
    fn selects_the_only_executable_architecture() {
        let architecture =
            select_thin_executable_architecture(&BTreeSet::from([TargetArchitecture::X86_64]))
                .expect("a thin Java executable has one unambiguous architecture");
        assert_eq!(architecture, TargetArchitecture::X86_64);
    }

    #[test]
    fn rejects_a_universal_executable_for_automatic_selection() {
        let error = select_thin_executable_architecture(&BTreeSet::from([
            TargetArchitecture::Arm64,
            TargetArchitecture::X86_64,
        ]))
        .expect_err("a universal executable does not prove the running JVM architecture");
        assert!(matches!(
            error,
            InjectorError::TargetArchitectureNotSingle { .. }
        ));
    }
}
