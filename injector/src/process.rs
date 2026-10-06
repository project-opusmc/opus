use crate::diagnostics::InjectorError;
use std::collections::BTreeMap;
use std::fmt::{Display, Formatter};
use std::process::Command;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ClientHint {
    Unknown,
    Vanilla,
    Forge,
    Lunar,
    Badlion,
}

impl Display for ClientHint {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        let value = match self {
            Self::Unknown => "unknown",
            Self::Vanilla => "vanilla",
            Self::Forge => "forge",
            Self::Lunar => "lunar",
            Self::Badlion => "badlion",
        };
        formatter.write_str(value)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum MinecraftJvmEvidence {
    MinecraftMainClass,
    MinecraftRuntimeMarker,
    LaunchWrapperMarker,
    GameDirectoryMarker,
    Minecraft189VersionMarker,
    ClientRuntimeMarker,
}

impl Display for MinecraftJvmEvidence {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        let value = match self {
            Self::MinecraftMainClass => "minecraft-main-class",
            Self::MinecraftRuntimeMarker => "minecraft-runtime-marker",
            Self::LaunchWrapperMarker => "launchwrapper-marker",
            Self::GameDirectoryMarker => "game-directory-marker",
            Self::Minecraft189VersionMarker => "minecraft-189-version-marker",
            Self::ClientRuntimeMarker => "client-runtime-marker",
        };
        formatter.write_str(value)
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MinecraftJvmCandidate {
    pub process: ProcessSnapshot,
    pub client_hint: ClientHint,
    pub evidence: Vec<MinecraftJvmEvidence>,
}

impl MinecraftJvmCandidate {
    pub fn evidence_summary(&self) -> String {
        self.evidence
            .iter()
            .map(ToString::to_string)
            .collect::<Vec<_>>()
            .join(",")
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProcessInstanceIdentity {
    pub started_at: String,
    pub command_fingerprint: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProcessSnapshot {
    pub pid: u32,
    pub parent_pid: u32,
    pub owner_uid: Option<u32>,
    pub executable: String,
    pub command_line: String,
    pub start_time: Option<String>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TargetOwnership {
    CurrentUser,
    DifferentUser,
    Unknown,
}

impl Display for TargetOwnership {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        let value = match self {
            Self::CurrentUser => "current-user",
            Self::DifferentUser => "different-user",
            Self::Unknown => "unknown",
        };
        formatter.write_str(value)
    }
}

impl ProcessSnapshot {
    pub fn is_java_minecraft_candidate(&self) -> bool {
        self.minecraft_jvm_candidate().is_some()
    }

    pub fn minecraft_jvm_candidate(&self) -> Option<MinecraftJvmCandidate> {
        if !self.is_java_process() {
            return None;
        }

        let lower_executable = self.executable.to_ascii_lowercase();
        let lower_command = self.command_line.to_ascii_lowercase();
        let evidence = minecraft_jvm_evidence(&lower_command);
        if !is_eligible_minecraft_jvm_evidence(&evidence) {
            return None;
        }

        Some(MinecraftJvmCandidate {
            process: self.clone(),
            client_hint: client_hint(&lower_executable, &lower_command),
            evidence,
        })
    }

    pub fn is_lunar_launcher_shell(&self) -> bool {
        if self.is_java_process() {
            return false;
        }
        let lower_executable = self.executable.to_ascii_lowercase();
        let lower_command = self.command_line.to_ascii_lowercase();
        (lower_executable.ends_with("/lunar client.app/contents/macos/lunar client")
            || lower_command.contains("lunar client.app/contents/macos/lunar client"))
            && !lower_command.contains("contents/frameworks/")
    }

    pub fn executable_name(&self) -> &str {
        self.executable
            .rsplit('/')
            .next()
            .unwrap_or(self.executable.as_str())
    }

    pub fn ownership_for(&self, current_user_id: u32) -> TargetOwnership {
        match self.owner_uid {
            Some(owner_uid) if owner_uid == current_user_id => TargetOwnership::CurrentUser,
            Some(_) => TargetOwnership::DifferentUser,
            None => TargetOwnership::Unknown,
        }
    }

    pub fn instance_identity(&self) -> Option<ProcessInstanceIdentity> {
        let started_at = self.start_time.as_deref()?.trim();
        if started_at.is_empty() {
            return None;
        }
        Some(ProcessInstanceIdentity {
            started_at: started_at.to_owned(),
            command_fingerprint: command_fingerprint(&self.command_line),
        })
    }

    pub fn is_opus_attach_harness(&self) -> bool {
        if !self.is_java_process() {
            return false;
        }
        let lower_command = self.command_line.to_ascii_lowercase();
        lower_command.contains("dev.opus.runtime.harness.attachtargetharness")
            && lower_command.contains("--ready-file")
            && lower_command.contains("--stop-file")
    }

    fn is_java_process(&self) -> bool {
        self.executable_name().eq_ignore_ascii_case("java")
            || self.executable_name().eq_ignore_ascii_case("javaw")
    }
}

fn minecraft_jvm_evidence(command_line: &str) -> Vec<MinecraftJvmEvidence> {
    let mut evidence = Vec::new();
    if command_line.contains("net.minecraft.client.main.main") {
        evidence.push(MinecraftJvmEvidence::MinecraftMainClass);
    }
    if has_minecraft_runtime_marker(command_line) {
        evidence.push(MinecraftJvmEvidence::MinecraftRuntimeMarker);
    }
    if command_line.contains("net.minecraft.launchwrapper.launch")
        || command_line.contains("launchwrapper")
        || command_line.contains("net.minecraftforge.fml.common.launcher")
    {
        evidence.push(MinecraftJvmEvidence::LaunchWrapperMarker);
    }
    if has_game_directory_marker(command_line) {
        evidence.push(MinecraftJvmEvidence::GameDirectoryMarker);
    }
    if has_minecraft_189_version_marker(command_line) {
        evidence.push(MinecraftJvmEvidence::Minecraft189VersionMarker);
    }
    if command_line.contains("lunar") || command_line.contains("badlion") {
        evidence.push(MinecraftJvmEvidence::ClientRuntimeMarker);
    }
    evidence
}

fn has_minecraft_runtime_marker(command_line: &str) -> bool {
    command_line.contains("net.minecraft.")
        || command_line.contains("minecraft.jar")
        || command_line.contains("minecraft-1.8.9")
}

fn has_game_directory_marker(command_line: &str) -> bool {
    command_line.contains("/.minecraft")
        || command_line.contains("\\.minecraft")
        || command_line.contains("--gamedir ")
        || command_line.contains("--gamedir=")
        || command_line.contains("-Dgame.directory=")
}

fn has_minecraft_189_version_marker(command_line: &str) -> bool {
    command_line.contains("--version 1.8.9")
        || command_line.contains("--version=1.8.9")
        || command_line.contains("minecraft-1.8.9")
        || command_line.contains("/1.8.9/")
}

fn is_eligible_minecraft_jvm_evidence(evidence: &[MinecraftJvmEvidence]) -> bool {
    let has = |expected| evidence.contains(&expected);
    let has_explicit_entry = has(MinecraftJvmEvidence::MinecraftMainClass)
        || has(MinecraftJvmEvidence::LaunchWrapperMarker);
    let has_runtime = has(MinecraftJvmEvidence::MinecraftRuntimeMarker);
    let has_game_directory = has(MinecraftJvmEvidence::GameDirectoryMarker);
    let has_189_version = has(MinecraftJvmEvidence::Minecraft189VersionMarker);
    let has_client_runtime = has(MinecraftJvmEvidence::ClientRuntimeMarker);

    (has_explicit_entry && (has_runtime || has_game_directory || has_189_version))
        || (has_game_directory && has_189_version)
        || (has_runtime && has_189_version)
        || (has_client_runtime && (has_runtime || has_game_directory || has_189_version))
}

fn client_hint(executable: &str, command_line: &str) -> ClientHint {
    if executable.contains("badlion client") || command_line.contains("badlion") {
        ClientHint::Badlion
    } else if executable.contains("lunar client") || command_line.contains("lunar") {
        ClientHint::Lunar
    } else if command_line.contains("forge")
        || command_line.contains("launchwrapper")
        || command_line.contains("fml")
    {
        ClientHint::Forge
    } else if command_line.contains("net.minecraft.client.main.main") {
        ClientHint::Vanilla
    } else {
        ClientHint::Unknown
    }
}

pub fn parse_ps_output(output: &str) -> Result<Vec<ProcessSnapshot>, InjectorError> {
    parse_process_rows(output, false)
}

pub fn parse_ps_output_with_owner(output: &str) -> Result<Vec<ProcessSnapshot>, InjectorError> {
    parse_process_rows(output, true)
}

fn parse_process_rows(
    output: &str,
    includes_owner_uid: bool,
) -> Result<Vec<ProcessSnapshot>, InjectorError> {
    output
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| {
            let (pid, parent_pid, owner_uid, command_line) = if includes_owner_uid {
                parse_ps_row_with_owner(line, "command")?
            } else {
                let (pid, parent_pid, command_line) = parse_ps_row(line, "command")?;
                (pid, parent_pid, None, command_line)
            };
            if command_line.is_empty() {
                return Err(InjectorError::ProcessInspectionFailed {
                    detail: format!("ps output has no command for {pid}"),
                });
            }
            Ok(ProcessSnapshot {
                pid,
                parent_pid,
                owner_uid,
                executable: fallback_executable(&command_line),
                command_line,
                start_time: None,
            })
        })
        .collect()
}

pub fn inspect_system_processes() -> Result<Vec<ProcessSnapshot>, InjectorError> {
    let command_output = ps_output("pid=,ppid=,uid=,command=")?;
    let executable_output = ps_output("pid=,ppid=,comm=")?;
    let start_time_output = ps_output("pid=,lstart=")?;
    let mut processes = parse_ps_output_with_owner(&command_output)?;
    apply_executable_paths(&mut processes, &executable_output)?;
    apply_start_times(&mut processes, &start_time_output)?;
    Ok(processes)
}

pub fn current_user_id() -> Result<u32, InjectorError> {
    let output = Command::new("id").arg("-u").output().map_err(|error| {
        InjectorError::ProcessInspectionFailed {
            detail: format!("Cannot determine current user: {error}"),
        }
    })?;
    if !output.status.success() {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        return Err(InjectorError::ProcessInspectionFailed {
            detail: if detail.is_empty() {
                format!(
                    "Cannot determine current user: id exited with {}",
                    output.status
                )
            } else {
                format!("Cannot determine current user: {detail}")
            },
        });
    }
    String::from_utf8_lossy(&output.stdout)
        .trim()
        .parse::<u32>()
        .map_err(|error| InjectorError::ProcessInspectionFailed {
            detail: format!("Cannot parse current user id: {error}"),
        })
}

fn ps_output(format: &str) -> Result<String, InjectorError> {
    let output = Command::new("ps")
        .args(["-axo", format])
        .output()
        .map_err(|error| InjectorError::ProcessInspectionFailed {
            detail: error.to_string(),
        })?;
    if !output.status.success() {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        return Err(InjectorError::ProcessInspectionFailed {
            detail: if detail.is_empty() {
                format!("ps exited with {}", output.status)
            } else {
                detail
            },
        });
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

fn apply_executable_paths(
    processes: &mut [ProcessSnapshot],
    executable_output: &str,
) -> Result<(), InjectorError> {
    let mut paths = BTreeMap::new();
    for line in executable_output
        .lines()
        .filter(|line| !line.trim().is_empty())
    {
        let (pid, parent_pid, executable) = parse_ps_row(line, "executable")?;
        paths.insert(pid, (parent_pid, executable));
    }

    for process in processes {
        if let Some((parent_pid, executable)) = paths.get(&process.pid)
            && *parent_pid == process.parent_pid
            && !executable.is_empty()
        {
            process.executable = executable.clone();
        }
    }
    Ok(())
}

fn apply_start_times(processes: &mut [ProcessSnapshot], output: &str) -> Result<(), InjectorError> {
    let mut start_times = BTreeMap::new();
    for line in output.lines().filter(|line| !line.trim().is_empty()) {
        let (pid, remaining) =
            take_ps_field(line).ok_or_else(|| InjectorError::ProcessInspectionFailed {
                detail: "ps output has no pid while reading process start time".to_owned(),
            })?;
        let pid = pid
            .parse::<u32>()
            .map_err(|error| InjectorError::ProcessInspectionFailed {
                detail: format!(
                    "ps output contains an invalid pid while reading start time: {error}"
                ),
            })?;
        let start_time = remaining.trim();
        if start_time.is_empty() {
            return Err(InjectorError::ProcessInspectionFailed {
                detail: format!("ps output has no process start time for {pid}"),
            });
        }
        start_times.insert(pid, start_time.to_owned());
    }

    for process in processes {
        process.start_time = start_times.get(&process.pid).cloned();
    }
    Ok(())
}

fn parse_ps_row(line: &str, value_label: &str) -> Result<(u32, u32, String), InjectorError> {
    let trimmed = line.trim_start();
    let (pid, remaining) =
        take_ps_field(trimmed).ok_or_else(|| InjectorError::ProcessInspectionFailed {
            detail: "ps output has no pid".to_owned(),
        })?;
    let pid = pid
        .parse::<u32>()
        .map_err(|error| InjectorError::ProcessInspectionFailed {
            detail: format!("ps output contains an invalid pid: {error}"),
        })?;
    let (parent_pid, value) =
        take_ps_field(remaining).ok_or_else(|| InjectorError::ProcessInspectionFailed {
            detail: format!("ps output has no parent pid for {pid}"),
        })?;
    let parent_pid =
        parent_pid
            .parse::<u32>()
            .map_err(|error| InjectorError::ProcessInspectionFailed {
                detail: format!("ps output contains an invalid parent pid: {error}"),
            })?;
    let value = value.trim_start().to_owned();
    if value.is_empty() {
        return Err(InjectorError::ProcessInspectionFailed {
            detail: format!("ps output has no {value_label} for {pid}"),
        });
    }
    Ok((pid, parent_pid, value))
}

fn parse_ps_row_with_owner(
    line: &str,
    value_label: &str,
) -> Result<(u32, u32, Option<u32>, String), InjectorError> {
    let trimmed = line.trim_start();
    let (pid, remaining) =
        take_ps_field(trimmed).ok_or_else(|| InjectorError::ProcessInspectionFailed {
            detail: "ps output has no pid".to_owned(),
        })?;
    let pid = pid
        .parse::<u32>()
        .map_err(|error| InjectorError::ProcessInspectionFailed {
            detail: format!("ps output contains an invalid pid: {error}"),
        })?;
    let (parent_pid, remaining) =
        take_ps_field(remaining).ok_or_else(|| InjectorError::ProcessInspectionFailed {
            detail: format!("ps output has no parent pid for {pid}"),
        })?;
    let parent_pid =
        parent_pid
            .parse::<u32>()
            .map_err(|error| InjectorError::ProcessInspectionFailed {
                detail: format!("ps output contains an invalid parent pid for {pid}: {error}"),
            })?;
    let (owner_uid, value) =
        take_ps_field(remaining).ok_or_else(|| InjectorError::ProcessInspectionFailed {
            detail: format!("ps output has no owner uid for {pid}"),
        })?;
    let owner_uid = owner_uid.parse::<u32>().map(Some).map_err(|error| {
        InjectorError::ProcessInspectionFailed {
            detail: format!("ps output contains an invalid owner uid for {pid}: {error}"),
        }
    })?;
    let value = value.trim_start().to_owned();
    if value.is_empty() {
        return Err(InjectorError::ProcessInspectionFailed {
            detail: format!("ps output has no {value_label} for {pid}"),
        });
    }
    Ok((pid, parent_pid, owner_uid, value))
}

fn take_ps_field(value: &str) -> Option<(&str, &str)> {
    let trimmed = value.trim_start();
    if trimmed.is_empty() {
        return None;
    }
    let end = trimmed.find(char::is_whitespace).unwrap_or(trimmed.len());
    Some((&trimmed[..end], &trimmed[end..]))
}

fn fallback_executable(command_line: &str) -> String {
    command_line
        .split_whitespace()
        .next()
        .unwrap_or_default()
        .to_owned()
}

pub fn candidate_processes(processes: &[ProcessSnapshot]) -> Vec<&ProcessSnapshot> {
    processes
        .iter()
        .filter(|process| process.is_java_minecraft_candidate())
        .collect()
}

pub fn minecraft_jvm_candidates(processes: &[ProcessSnapshot]) -> Vec<MinecraftJvmCandidate> {
    processes
        .iter()
        .filter_map(ProcessSnapshot::minecraft_jvm_candidate)
        .collect()
}

pub fn lunar_launcher_processes(processes: &[ProcessSnapshot]) -> Vec<&ProcessSnapshot> {
    processes
        .iter()
        .filter(|process| process.is_lunar_launcher_shell())
        .collect()
}

pub fn find_process(
    processes: &[ProcessSnapshot],
    pid: u32,
) -> Result<&ProcessSnapshot, InjectorError> {
    processes
        .iter()
        .find(|process| process.pid == pid)
        .ok_or(InjectorError::ProcessNotFound { pid })
}

pub fn find_minecraft_jvm_candidate(
    processes: &[ProcessSnapshot],
    pid: u32,
) -> Result<MinecraftJvmCandidate, InjectorError> {
    find_process(processes, pid)?
        .minecraft_jvm_candidate()
        .ok_or(InjectorError::UnsupportedRuntimeCandidate { pid })
}

pub fn require_current_user_ownership(
    process: &ProcessSnapshot,
    current_user_id: u32,
) -> Result<(), InjectorError> {
    match process.ownership_for(current_user_id) {
        TargetOwnership::CurrentUser => Ok(()),
        TargetOwnership::DifferentUser => {
            Err(InjectorError::TargetOwnershipMismatch { pid: process.pid })
        }
        TargetOwnership::Unknown => Err(InjectorError::TargetOwnershipUnknown { pid: process.pid }),
    }
}

pub fn find_owned_minecraft_jvm_candidate(
    processes: &[ProcessSnapshot],
    pid: u32,
    current_user_id: u32,
) -> Result<MinecraftJvmCandidate, InjectorError> {
    let candidate = find_minecraft_jvm_candidate(processes, pid)?;
    require_current_user_ownership(&candidate.process, current_user_id)?;
    Ok(candidate)
}

pub fn find_owned_attach_harness(
    processes: &[ProcessSnapshot],
    pid: u32,
    current_user_id: u32,
) -> Result<ProcessSnapshot, InjectorError> {
    let process = find_process(processes, pid)?;
    require_current_user_ownership(process, current_user_id)?;
    if !process.is_opus_attach_harness() {
        return Err(InjectorError::JvmAttachHarnessTargetMismatch { pid });
    }
    Ok(process.clone())
}

fn command_fingerprint(command_line: &str) -> String {
    let hash = command_line
        .as_bytes()
        .iter()
        .fold(0xcbf29ce484222325u64, |hash, byte| {
            (hash ^ u64::from(*byte)).wrapping_mul(0x100000001b3)
        });
    format!("{hash:016x}")
}

#[cfg(test)]
mod tests {
    use super::{
        ClientHint, MinecraftJvmEvidence, ProcessSnapshot, apply_executable_paths,
        candidate_processes, find_owned_attach_harness, find_owned_minecraft_jvm_candidate,
        lunar_launcher_processes, minecraft_jvm_candidates, parse_ps_output,
        parse_ps_output_with_owner,
    };

    #[test]
    fn finds_only_explicit_java_client_candidates() {
        let processes = parse_ps_output(
            "101 1 /usr/bin/java net.minecraft.client.main.Main\n\
             102 1 /usr/bin/java com.example.Tool\n\
             103 1 /Applications/Lunar/java -Dlunar.client=true --gameDir /Users/example/.minecraft --version 1.8.9\n",
        )
        .expect("fixture ps output should parse");

        let candidates = candidate_processes(&processes);
        assert_eq!(candidates.len(), 2);
        assert_eq!(candidates[0].pid, 101);
        assert_eq!(candidates[1].pid, 103);
    }

    #[test]
    fn reports_client_hints_separately_from_minecraft_jvm_eligibility() {
        let processes = parse_ps_output(
            "101 1 /usr/bin/java net.minecraft.client.main.Main\n\
             102 1 /usr/bin/java net.minecraft.launchwrapper.Launch --tweakClass net.minecraftforge.fml.common.launcher.FMLTweaker\n\
             103 1 /Applications/Lunar/java -Dlunar.client=true --gameDir /Users/example/.minecraft --version 1.8.9\n\
             104 1 /Applications/Badlion/java -Dbadlion.client=true --gameDir /Users/example/.minecraft --version 1.8.9\n\
             105 1 /usr/bin/java -Dgame.directory=/Users/example/.minecraft --version 1.8.9 custom.bootstrap.Main\n\
             106 1 /usr/bin/java com.example.Tool\n",
        )
        .expect("fixture ps output should parse");

        let candidates = minecraft_jvm_candidates(&processes);
        assert_eq!(candidates.len(), 5);
        assert_eq!(candidates[0].client_hint, ClientHint::Vanilla);
        assert_eq!(candidates[1].client_hint, ClientHint::Forge);
        assert_eq!(candidates[2].client_hint, ClientHint::Lunar);
        assert_eq!(candidates[3].client_hint, ClientHint::Badlion);
        assert_eq!(candidates[4].client_hint, ClientHint::Unknown);
        assert_eq!(
            candidates[0].evidence,
            vec![
                MinecraftJvmEvidence::MinecraftMainClass,
                MinecraftJvmEvidence::MinecraftRuntimeMarker,
            ]
        );
    }

    #[test]
    fn rejects_an_incidental_minecraft_word_without_runtime_evidence() {
        let processes = parse_ps_output(
            "101 1 /usr/bin/java com.example.minecraft.Tool\n\
             102 1 /usr/bin/java -Ddescription=minecraft-not-a-game com.example.Tool\n\
             103 1 /usr/bin/java -Dgame.directory=/Users/example/.minecraft custom.bootstrap.Main\n\
             104 1 /usr/bin/java -Dgame.directory=/Users/example/.minecraft --version 1.8.9 custom.bootstrap.Main\n",
        )
        .expect("fixture ps output should parse");

        let candidates = minecraft_jvm_candidates(&processes);
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].process.pid, 104);
        assert_eq!(
            candidates[0].evidence,
            vec![
                MinecraftJvmEvidence::GameDirectoryMarker,
                MinecraftJvmEvidence::Minecraft189VersionMarker,
            ]
        );
    }

    #[test]
    fn parses_owner_uid_and_rejects_a_foreign_selected_candidate() {
        let processes = parse_ps_output_with_owner(
            "101 1 501 /usr/bin/java net.minecraft.client.main.Main\n\
             102 1 502 /usr/bin/java net.minecraft.client.main.Main\n",
        )
        .expect("fixture ps output with owners should parse");

        assert_eq!(processes[0].owner_uid, Some(501));
        find_owned_minecraft_jvm_candidate(&processes, 101, 501)
            .expect("the current user's selected Minecraft JVM should pass ownership validation");

        let error = find_owned_minecraft_jvm_candidate(&processes, 102, 501)
            .expect_err("a foreign Minecraft JVM must not pass ownership validation");
        assert_eq!(error.code(), "TargetOwnershipMismatch");
    }

    #[test]
    fn identifies_a_java_target_when_the_executable_path_contains_spaces() {
        let mut processes = parse_ps_output(
            "301 1 /Users/example/Library/Application Support/Client/bin/java net.minecraft.client.main.Main\n",
        )
        .expect("fixture ps output should parse");
        apply_executable_paths(
            &mut processes,
            "301 1 /Users/example/Library/Application Support/Client/bin/java\n",
        )
        .expect("fixture executable output should parse");

        let candidates = candidate_processes(&processes);
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].pid, 301);
        assert_eq!(candidates[0].executable_name(), "java");
    }

    #[test]
    fn prioritizes_a_badlion_jre_path_over_an_incidental_lunar_marker() {
        let mut processes = parse_ps_output(
            "302 1 /usr/bin/java net.minecraft.launchwrapper.Launch -Dlunar.webosr.url=file:index.html --gameDir /Users/example/.minecraft --version 1.8.9\n",
        )
        .expect("fixture ps output should parse");
        apply_executable_paths(
            &mut processes,
            "302 1 /Users/example/Library/Application Support/Badlion Client/Data/zulu.jre/Contents/Home/bin/java\n",
        )
        .expect("fixture executable output should parse");

        let candidates = minecraft_jvm_candidates(&processes);
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].client_hint, ClientHint::Badlion);
    }

    #[test]
    fn distinguishes_lunar_desktop_shells_from_java_game_candidates() {
        let processes = parse_ps_output(
            "201 1 /Applications/Lunar Client.app/Contents/MacOS/Lunar Client\n\
             202 201 /Applications/Lunar Client.app/Contents/Frameworks/Lunar Client Helper --type=gpu-process\n\
             203 1 /Applications/Lunar/java -Dlunar.client=true --gameDir /Users/example/.minecraft --version 1.8.9\n",
        )
        .expect("fixture ps output should parse");

        let launchers = lunar_launcher_processes(&processes);
        assert_eq!(launchers.len(), 1);
        assert_eq!(launchers[0].pid, 201);

        let candidates = candidate_processes(&processes);
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].pid, 203);
    }

    #[test]
    fn recognizes_only_the_source_controlled_attach_harness() {
        let processes = parse_ps_output_with_owner(
            "701 1 501 /usr/bin/java -cp /tmp/classes dev.opus.runtime.harness.AttachTargetHarness --ready-file /tmp/ready --stop-file /tmp/stop\n\
             702 1 501 /usr/bin/java -cp /tmp/classes dev.opus.runtime.harness.OtherTarget --ready-file /tmp/ready --stop-file /tmp/stop\n",
        )
        .expect("fixture ps output should parse");

        let target = find_owned_attach_harness(&processes, 701, 501)
            .expect("the explicit Attach harness must be recognized");
        assert_eq!(target.pid, 701);
        let error = find_owned_attach_harness(&processes, 702, 501)
            .expect_err("a different Java process must not be an Attach harness target");
        assert_eq!(error.code(), "JvmAttachHarnessTargetMismatch");
    }

    #[test]
    fn process_instance_identity_changes_for_new_process_metadata() {
        let process = ProcessSnapshot {
            pid: 42,
            parent_pid: 1,
            owner_uid: Some(501),
            executable: "/usr/bin/java".to_owned(),
            command_line: "/usr/bin/java net.minecraft.client.main.Main".to_owned(),
            start_time: Some("Wed Sep 10 12:00:00 2026".to_owned()),
        };
        let identity = process
            .instance_identity()
            .expect("a process with start metadata has an identity");
        assert_eq!(identity.started_at, "Wed Sep 10 12:00:00 2026");
        assert_eq!(identity.command_fingerprint.len(), 16);
    }
}
