package dev.opus.runtime.harness;

import java.io.File;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Test-only Java 8-compatible command-line bridge to the JDK Attach API.
 *
 * <p>This process runs outside the source-controlled {@link AttachTargetHarness}
 * JVM. It invokes
 * {@code VirtualMachine.loadAgentPath} through reflection so the source remains
 * Java 8 bytecode compatible while allowing a modern JDK to supply the Attach
 * API at runtime. It is not an OPUS production transport.</p>
 */
public final class AttachHarnessMain {
    private static final int PROTOCOL_VERSION = 1;

    private AttachHarnessMain() {
    }

    public static void main(String[] args) {
        try {
            Config config = Config.parse(args);
            invokeAttach(config);
            System.out.println(
                "OPUS_ATTACH_HARNESS operation="
                    + config.operation
                    + " result=ok pid="
                    + config.pid
            );
        } catch (Exception error) {
            System.err.println(
                "OPUS_ATTACH_HARNESS_ERROR "
                    + sanitize(error.getClass().getSimpleName())
                    + ":"
                    + sanitize(error.getMessage())
            );
            System.exit(2);
        }
    }

    private static void invokeAttach(Config config) throws Exception {
        final Class<?> virtualMachineClass;
        try {
            virtualMachineClass = Class.forName(
                "com.sun.tools.attach.VirtualMachine"
            );
        } catch (ClassNotFoundException error) {
            throw new IllegalStateException(
                "JDK Attach API is unavailable; use a JDK with jdk.attach for the test harness",
                error
            );
        }

        Method attach = virtualMachineClass.getMethod("attach", String.class);
        Object virtualMachine = invoke(attach, null, String.valueOf(config.pid));
        Exception detachFailure = null;
        try {
            Method loadAgentPath = virtualMachineClass.getMethod(
                "loadAgentPath",
                String.class,
                String.class
            );
            invoke(
                loadAgentPath,
                virtualMachine,
                config.runtime.getPath(),
                config.agentOptions()
            );
        } finally {
            try {
                Method detach = virtualMachineClass.getMethod("detach");
                invoke(detach, virtualMachine);
            } catch (Exception error) {
                detachFailure = error;
            }
        }
        if (detachFailure != null) {
            throw detachFailure;
        }
    }

    private static Object invoke(
        Method method,
        Object receiver,
        Object... arguments
    ) throws Exception {
        try {
            return method.invoke(receiver, arguments);
        } catch (IllegalAccessException error) {
            throw new IllegalStateException(
                "Unable to access JDK Attach API",
                error
            );
        } catch (InvocationTargetException error) {
            Throwable cause = error.getCause();
            if (cause instanceof Exception) {
                throw (Exception) cause;
            }
            throw new IllegalStateException(
                "JDK Attach API failed with a non-Exception throwable",
                cause
            );
        }
    }

    private static String percentEncode(String value) {
        StringBuilder encoded = new StringBuilder();
        byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
        for (byte valueByte : bytes) {
            int unsigned = valueByte & 0xff;
            if (
                (unsigned >= 'a' && unsigned <= 'z')
                    || (unsigned >= 'A' && unsigned <= 'Z')
                    || (unsigned >= '0' && unsigned <= '9')
                    || unsigned == '-'
                    || unsigned == '.'
                    || unsigned == '_'
                    || unsigned == '~'
            ) {
                encoded.append((char) unsigned);
            } else {
                encoded.append('%');
                String hex = Integer.toHexString(unsigned).toUpperCase();
                if (hex.length() == 1) {
                    encoded.append('0');
                }
                encoded.append(hex);
            }
        }
        return encoded.toString();
    }

    private static String sanitize(String value) {
        if (value == null || value.trim().isEmpty()) {
            return "unspecified";
        }
        return value.replace('\n', ' ').replace('\r', ' ');
    }

    private static final class Config {
        private final long pid;
        private final File runtime;
        private final String operation;
        private final File report;
        private final String capability;
        private final String targetArchitecture;
        private final String injectorVersion;

        private Config(
            long pid,
            File runtime,
            String operation,
            File report,
            String capability,
            String targetArchitecture,
            String injectorVersion
        ) {
            this.pid = pid;
            this.runtime = runtime;
            this.operation = operation;
            this.report = report;
            this.capability = capability;
            this.targetArchitecture = targetArchitecture;
            this.injectorVersion = injectorVersion;
        }

        private static Config parse(String[] arguments) throws Exception {
            Map<String, String> values = new LinkedHashMap<String, String>();
            for (int index = 0; index < arguments.length; index += 2) {
                if (index + 1 >= arguments.length) {
                    throw new IllegalArgumentException(
                        "Every Attach harness option requires a value"
                    );
                }
                String name = arguments[index];
                String value = arguments[index + 1];
                if (
                    !("--pid".equals(name)
                        || "--runtime".equals(name)
                        || "--operation".equals(name)
                        || "--report".equals(name)
                        || "--capability".equals(name)
                        || "--target-architecture".equals(name)
                        || "--injector-version".equals(name))
                    || value.trim().isEmpty()
                    || values.put(name, value) != null
                ) {
                    throw new IllegalArgumentException(
                        "Invalid or duplicate Attach harness option: " + name
                    );
                }
            }
            if (values.size() != 7) {
                throw new IllegalArgumentException(
                    "Expected --pid, --runtime, --operation, --report, --capability, "
                        + "--target-architecture, and --injector-version"
                );
            }

            long pid;
            try {
                pid = Long.parseLong(required(values, "--pid"));
            } catch (NumberFormatException error) {
                throw new IllegalArgumentException("PID must be a positive integer", error);
            }
            if (pid <= 0L) {
                throw new IllegalArgumentException("PID must be a positive integer");
            }

            File runtime = new File(required(values, "--runtime")).getCanonicalFile();
            if (!runtime.isFile()) {
                throw new IllegalArgumentException(
                    "Native runtime is not a regular file: " + runtime
                );
            }

            String operation = required(values, "--operation");
            if (!("load".equals(operation) || "unload".equals(operation))) {
                throw new IllegalArgumentException(
                    "operation must be load or unload"
                );
            }

            File report = new File(required(values, "--report")).getCanonicalFile();
            if (report.exists() || report.getParentFile() == null
                || !report.getParentFile().isDirectory()) {
                throw new IllegalArgumentException(
                    "Report path must not exist in an existing directory"
                );
            }

            String capability = required(values, "--capability");
            if (!capability.matches("[0-9a-f]{64}")) {
                throw new IllegalArgumentException(
                    "capability must contain exactly 64 lowercase hexadecimal characters"
                );
            }

            String targetArchitecture = required(
                values,
                "--target-architecture"
            );
            if (
                !("arm64".equals(targetArchitecture)
                    || "x86_64".equals(targetArchitecture))
            ) {
                throw new IllegalArgumentException(
                    "target architecture must be arm64 or x86_64"
                );
            }

            String injectorVersion = required(values, "--injector-version");
            if (!injectorVersion.matches("[0-9A-Za-z.+-]{1,64}")) {
                throw new IllegalArgumentException(
                    "injector version has unsupported characters"
                );
            }

            return new Config(
                pid,
                runtime,
                operation,
                report,
                capability,
                targetArchitecture,
                injectorVersion
            );
        }

        private String agentOptions() {
            return "protocolVersion=" + PROTOCOL_VERSION
                + "&operation=" + operation
                + "&reportPath=" + percentEncode(report.getPath())
                + "&capability=" + capability
                + "&targetArchitecture=" + targetArchitecture
                + "&injectorVersion=" + injectorVersion;
        }

        private static String required(Map<String, String> values, String name) {
            String value = values.get(name);
            if (value == null) {
                throw new IllegalArgumentException("Missing " + name);
            }
            return value;
        }
    }
}
