use crate::diagnostics::InjectorError;
use crate::process::{
    ProcessSnapshot, find_process, inspect_system_processes, require_current_user_ownership,
};
use std::path::Path;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

const LLDB_EXECUTABLE: &str = "/usr/bin/lldb";
const LLDB_PROBE_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LldbDevelopmentStatus {
    Available,
    Unavailable,
    TimedOut,
    TargetExited,
}

impl LldbDevelopmentStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Available => "available",
            Self::Unavailable => "unavailable",
            Self::TimedOut => "timed-out",
            Self::TargetExited => "target-exited",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LldbDevelopmentReport {
    pub pid: u32,
    pub status: LldbDevelopmentStatus,
}

impl LldbDevelopmentReport {
    pub fn summary(&self) -> String {
        format!(
            "pid={} lldb_development_status={} development_only=true source_controlled_harness=true retail_client_fallback=false",
            self.pid,
            self.status.as_str(),
        )
    }
}

pub fn probe_lldb_development_harness(
    processes: &[ProcessSnapshot],
    current_user_id: u32,
    pid: u32,
) -> Result<LldbDevelopmentReport, InjectorError> {
    let target = find_process(processes, pid)?;
    require_current_user_ownership(target, current_user_id)?;
    if !target.is_opus_attach_harness() {
        return Err(InjectorError::LldbDevelopmentHarnessTargetMismatch { pid });
    }
    let target = target.clone();
    let status = probe_lldb(&target);
    let status = if target_is_still_alive(&target)? {
        status
    } else {
        LldbDevelopmentStatus::TargetExited
    };
    Ok(LldbDevelopmentReport { pid, status })
}

fn probe_lldb(target: &ProcessSnapshot) -> LldbDevelopmentStatus {
    #[cfg(not(target_os = "macos"))]
    {
        let _ = target;
        return LldbDevelopmentStatus::Unavailable;
    }

    #[cfg(target_os = "macos")]
    {
        let executable = Path::new(LLDB_EXECUTABLE);
        if !executable.is_file() {
            return LldbDevelopmentStatus::Unavailable;
        }

        let mut child = match Command::new(executable)
            .args([
                "--batch",
                "--one-line",
                &format!("process attach --pid {}", target.pid),
                "--one-line",
                "process detach",
            ])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
        {
            Ok(child) => child,
            Err(_) => return LldbDevelopmentStatus::Unavailable,
        };

        let deadline = Instant::now() + LLDB_PROBE_TIMEOUT;
        loop {
            match child.try_wait() {
                Ok(Some(status)) => {
                    return if status.success() {
                        LldbDevelopmentStatus::Available
                    } else {
                        LldbDevelopmentStatus::Unavailable
                    };
                }
                Ok(None) if Instant::now() < deadline => thread::sleep(Duration::from_millis(20)),
                Ok(None) => {
                    let _ = child.kill();
                    let _ = child.wait();
                    return LldbDevelopmentStatus::TimedOut;
                }
                Err(_) => return LldbDevelopmentStatus::Unavailable,
            }
        }
    }
}

fn target_is_still_alive(target: &ProcessSnapshot) -> Result<bool, InjectorError> {
    let Some(identity) = target.instance_identity() else {
        return Ok(false);
    };
    let processes = inspect_system_processes()?;
    Ok(processes.iter().any(|candidate| {
        candidate.pid == target.pid && candidate.instance_identity().as_ref() == Some(&identity)
    }))
}

#[cfg(test)]
mod tests {
    use super::{LldbDevelopmentReport, LldbDevelopmentStatus};

    #[test]
    fn keeps_the_lldb_lane_explicitly_development_only() {
        let report = LldbDevelopmentReport {
            pid: 42,
            status: LldbDevelopmentStatus::Unavailable,
        };

        assert_eq!(report.status.as_str(), "unavailable");
        assert!(report.summary().contains("development_only=true"));
        assert!(report.summary().contains("retail_client_fallback=false"));
    }
}
