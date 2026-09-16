use crate::diagnostics::InjectorError;
use crate::process::{
    ProcessSnapshot, find_owned_minecraft_jvm_candidate, inspect_system_processes,
};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Output, Stdio};
use std::thread;
use std::time::{Duration, Instant};

const JVM_ATTACH_PROBE_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum JvmAttachProbeStatus {
    Available,
    Disabled,
    Unavailable,
    TimedOut,
    TargetExited,
}

impl JvmAttachProbeStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Available => "available",
            Self::Disabled => "disabled",
            Self::Unavailable => "unavailable",
            Self::TimedOut => "timed-out",
            Self::TargetExited => "target-exited",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct JvmAttachProbeReport {
    pub pid: u32,
    pub status: JvmAttachProbeStatus,
}

impl JvmAttachProbeReport {
    pub fn summary(&self) -> String {
        format!(
            "pid={} jvm_attach={} query=VM.version agent_load=false command_line_inference=false diagnostic_only=true",
            self.pid,
            self.status.as_str(),
        )
    }
}

pub fn probe_jvm_attach_capability(
    processes: &[ProcessSnapshot],
    current_user_id: u32,
    pid: u32,
) -> Result<JvmAttachProbeReport, InjectorError> {
    let target = find_owned_minecraft_jvm_candidate(processes, pid, current_user_id)?;
    let status = jcmd_path(&target.process.executable)
        .map_or(JvmAttachProbeStatus::Unavailable, |jcmd| {
            probe_jcmd(&jcmd, target.process.pid)
        });
    let status = if target_is_still_alive(&target.process)? {
        status
    } else {
        JvmAttachProbeStatus::TargetExited
    };
    Ok(JvmAttachProbeReport {
        pid: target.process.pid,
        status,
    })
}

fn jcmd_path(executable: &str) -> Option<PathBuf> {
    let candidate = Path::new(executable).parent()?.join("jcmd");
    candidate.is_file().then_some(candidate)
}

fn probe_jcmd(jcmd: &Path, pid: u32) -> JvmAttachProbeStatus {
    let child = Command::new(jcmd)
        .arg(pid.to_string())
        .arg("VM.version")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn();
    let Ok(child) = child else {
        return JvmAttachProbeStatus::Unavailable;
    };
    let Ok(output) = wait_for_output(child) else {
        return JvmAttachProbeStatus::TimedOut;
    };
    classify_jcmd_result(&output)
}

fn wait_for_output(mut child: Child) -> Result<Output, ()> {
    let deadline = Instant::now() + JVM_ATTACH_PROBE_TIMEOUT;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if Instant::now() < deadline => thread::sleep(Duration::from_millis(20)),
            Ok(None) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(());
            }
            Err(_) => return Err(()),
        }
    };

    let mut stdout = Vec::new();
    let mut stderr = Vec::new();
    if let Some(mut source) = child.stdout.take() {
        source.read_to_end(&mut stdout).map_err(|_| ())?;
    }
    if let Some(mut source) = child.stderr.take() {
        source.read_to_end(&mut stderr).map_err(|_| ())?;
    }
    Ok(Output {
        status,
        stdout,
        stderr,
    })
}

fn classify_jcmd_result(output: &Output) -> JvmAttachProbeStatus {
    if output.status.success() {
        return JvmAttachProbeStatus::Available;
    }
    let detail = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    )
    .to_ascii_lowercase();
    if detail.contains("attachnotsupportedexception")
        || detail.contains("does not support the attach mechanism")
        || detail.contains("attach mechanism is disabled")
    {
        JvmAttachProbeStatus::Disabled
    } else {
        JvmAttachProbeStatus::Unavailable
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
    use super::{JvmAttachProbeStatus, classify_jcmd_result};
    use std::os::unix::process::ExitStatusExt;
    use std::process::{ExitStatus, Output};

    fn output(success: bool, detail: &str) -> Output {
        let status = if success {
            ExitStatus::from_raw(0)
        } else {
            ExitStatus::from_raw(1)
        };
        Output {
            status,
            stdout: detail.as_bytes().to_vec(),
            stderr: Vec::new(),
        }
    }

    #[test]
    fn recognizes_a_successful_benign_attach_query() {
        assert_eq!(
            classify_jcmd_result(&output(true, "1234:\nOpenJDK 64-Bit Server VM")),
            JvmAttachProbeStatus::Available
        );
    }

    #[test]
    fn recognizes_a_disabled_attach_mechanism() {
        assert_eq!(
            classify_jcmd_result(&output(
                false,
                "com.sun.tools.attach.AttachNotSupportedException: The VM does not support the attach mechanism"
            )),
            JvmAttachProbeStatus::Disabled
        );
    }
}
