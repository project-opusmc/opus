package dev.opus.runtime.harness;

import dev.opus.runtime.bridge.NativeRuntimeBridge;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.lang.management.ManagementFactory;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.net.URLDecoder;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * A separately launched, opt-in target for the M3 authorized-target transport
 * proof. It binds only to loopback and will load only the native runtime path
 * explicitly authorized at startup. It is not a Minecraft client and is not a
 * general target-process loader.
 */
public final class AuthorizedRuntimeTarget {
    private static final int PROTOCOL_VERSION = 1;
    private static final int SOCKET_TIMEOUT_MILLIS = 1000;
    private static final int MAX_REQUEST_LENGTH = 4096;
    private static final String TARGET_KIND = "opus-authorized-test-harness";
    private static final String REQUEST_PREFIX =
        "OPUS_AUTHORIZED_TARGET_REQUEST ";
    private static final String RESPONSE_PREFIX =
        "OPUS_AUTHORIZED_TARGET_RESPONSE ";
    private static final String NATIVE_RUNTIME_VERSION = "0.1.0";
    private static final String JAVA_RUNTIME_VERSION = "not-built";
    private static final String MAPPING_SCHEMA_VERSION = "not-applicable";
    private static final String ONECONFIG_ADAPTER_VERSION = "not-loaded";
    private static final String ARTIFACT_CHECKSUMS = "not-packaged";

    private AuthorizedRuntimeTarget() {
    }

    public static void main(String[] args) throws Exception {
        TargetConfig config = TargetConfig.parse(args);
        String injectorVersion = requiredProperty("opus.injector.version");
        String targetArchitecture = normalizeArchitecture(
            System.getProperty("os.arch")
        );
        long targetPid = currentPid();
        File allowedRuntime = new File(config.allowedRuntime).getCanonicalFile();
        if (!allowedRuntime.isFile()) {
            throw new IllegalStateException(
                "Authorized runtime path does not exist: " + allowedRuntime
            );
        }

        File descriptor = new File(config.descriptor).getAbsoluteFile();
        if (descriptor.exists()) {
            throw new IllegalStateException(
                "Authorized target descriptor already exists: " + descriptor
            );
        }

        boolean descriptorWritten = false;
        try (
            ServerSocket server = new ServerSocket(
                0,
                8,
                InetAddress.getByName("127.0.0.1")
            )
        ) {
            server.setSoTimeout(SOCKET_TIMEOUT_MILLIS);
            writeDescriptor(
                descriptor,
                targetPid,
                server.getLocalPort(),
                targetArchitecture,
                config.capability
            );
            descriptorWritten = true;
            emit(
                "OPUS_AUTHORIZED_TARGET_LISTENING "
                    + "targetPid=" + targetPid
                    + ";targetArchitecture=" + targetArchitecture
                    + ";state=waiting"
            );

            TargetState state = new TargetState();
            boolean serving = true;
            while (serving) {
                try {
                    Socket socket = server.accept();
                    try {
                        serving = handleConnection(
                            socket,
                            config,
                            allowedRuntime,
                            injectorVersion,
                            targetPid,
                            targetArchitecture,
                            state
                        );
                    } finally {
                        socket.close();
                    }
                } catch (SocketTimeoutException ignored) {
                    // A timeout is only a chance to observe a stop request.
                }
            }
        } finally {
            if (descriptorWritten && descriptor.exists() && !descriptor.delete()) {
                System.err.println(
                    "[OPUS/AUTHORIZED-TARGET] WARN unable to remove descriptor "
                        + descriptor
                );
            }
        }
    }

    private static boolean handleConnection(
        Socket socket,
        TargetConfig config,
        File allowedRuntime,
        String injectorVersion,
        long targetPid,
        String targetArchitecture,
        TargetState state
    ) throws IOException {
        socket.setSoTimeout(SOCKET_TIMEOUT_MILLIS);
        BufferedReader input = new BufferedReader(
            new InputStreamReader(socket.getInputStream(), "UTF-8")
        );
        PrintWriter output = new PrintWriter(
            new OutputStreamWriter(socket.getOutputStream(), "UTF-8"),
            true
        );
        String request = input.readLine();
        if (request == null || request.length() > MAX_REQUEST_LENGTH) {
            writeResponse(
                output,
                "health",
                "InvalidRequest",
                lifecycleState(state),
                injectorVersion,
                targetPid,
                targetArchitecture
            );
            return true;
        }
        if (!socket.getInetAddress().isLoopbackAddress()) {
            writeResponse(
                output,
                requestedOperation(request),
                "PeerNotAllowed",
                lifecycleState(state),
                injectorVersion,
                targetPid,
                targetArchitecture
            );
            return true;
        }

        String operation = requestedOperation(request);
        try {
            Map<String, String> fields = parseRequest(request);
            String validationCode = validateRequest(
                fields,
                operation,
                config,
                targetPid,
                targetArchitecture
            );
            if (validationCode != null) {
                writeResponse(
                    output,
                    operation,
                    validationCode,
                    lifecycleState(state),
                    injectorVersion,
                    targetPid,
                    targetArchitecture
                );
                return true;
            }

            if ("load".equals(operation)) {
                return handleLoad(
                    output,
                    fields,
                    allowedRuntime,
                    injectorVersion,
                    targetPid,
                    targetArchitecture,
                    state
                );
            }
            if ("unload".equals(operation)) {
                return handleUnload(
                    output,
                    injectorVersion,
                    targetPid,
                    targetArchitecture,
                    state
                );
            }
            if ("health".equals(operation)) {
                writeResponse(
                    output,
                    operation,
                    "TargetAlive",
                    lifecycleState(state),
                    injectorVersion,
                    targetPid,
                    targetArchitecture
                );
                return true;
            }
            if ("stop".equals(operation)) {
                if (state.runtimeLoaded && !state.shutdownComplete) {
                    writeResponse(
                        output,
                        operation,
                        "ShutdownRequired",
                        lifecycleState(state),
                        injectorVersion,
                        targetPid,
                        targetArchitecture
                    );
                    return true;
                }
                writeResponse(
                    output,
                    operation,
                    "TargetStopping",
                    "stopped",
                    injectorVersion,
                    targetPid,
                    targetArchitecture
                );
                return false;
            }

            writeResponse(
                output,
                operation,
                "UnsupportedOperation",
                lifecycleState(state),
                injectorVersion,
                targetPid,
                targetArchitecture
            );
            return true;
        } catch (RuntimeException error) {
            writeResponse(
                output,
                operation,
                "InvalidRequest",
                lifecycleState(state),
                injectorVersion,
                targetPid,
                targetArchitecture
            );
            return true;
        }
    }

    private static boolean handleLoad(
        PrintWriter output,
        Map<String, String> fields,
        File allowedRuntime,
        String injectorVersion,
        long targetPid,
        String targetArchitecture,
        TargetState state
    ) throws IOException {
        File requestedRuntime;
        try {
            requestedRuntime = new File(
                URLDecoder.decode(requiredField(fields, "runtimePath"), "UTF-8")
            ).getCanonicalFile();
        } catch (Exception error) {
            writeResponse(
                output,
                "load",
                "RuntimePathInvalid",
                lifecycleState(state),
                injectorVersion,
                targetPid,
                targetArchitecture
            );
            return true;
        }
        if (!allowedRuntime.equals(requestedRuntime)) {
            writeResponse(
                output,
                "load",
                "RuntimePathNotAuthorized",
                lifecycleState(state),
                injectorVersion,
                targetPid,
                targetArchitecture
            );
            return true;
        }
        if (state.runtimeLoaded && !state.shutdownComplete) {
            writeResponse(
                output,
                "load",
                "RuntimeAlreadyRunning",
                lifecycleState(state),
                injectorVersion,
                targetPid,
                targetArchitecture
            );
            return true;
        }

        try {
            String probe;
            if (!state.runtimeLoaded) {
                System.load(requestedRuntime.getPath());
                state.runtimeLoaded = true;
                state.loadedRuntime = requestedRuntime;
                probe = NativeRuntimeBridge.probe();
            } else if (!requestedRuntime.equals(state.loadedRuntime)) {
                writeResponse(
                    output,
                    "load",
                    "RuntimePathNotAuthorized",
                    lifecycleState(state),
                    injectorVersion,
                    targetPid,
                    targetArchitecture
                );
                return true;
            } else {
                probe = NativeRuntimeBridge.restart();
            }
            requireTokens(
                probe,
                Arrays.asList(
                    "runtime_version=" + NATIVE_RUNTIME_VERSION,
                    "vm_discovery=ok",
                    "jni=ok",
                    "jvmti=ok",
                    "worker_attach_detach=ok",
                    "state=running"
                )
            );
            state.shutdownComplete = false;
            writeResponse(
                output,
                "load",
                "Ready",
                "running",
                injectorVersion,
                targetPid,
                targetArchitecture
            );
        } catch (Throwable error) {
            writeResponse(
                output,
                "load",
                "NativeEntryFailed",
                lifecycleState(state),
                injectorVersion,
                targetPid,
                targetArchitecture
            );
        }
        return true;
    }

    private static boolean handleUnload(
        PrintWriter output,
        String injectorVersion,
        long targetPid,
        String targetArchitecture,
        TargetState state
    ) {
        if (!state.runtimeLoaded || state.shutdownComplete) {
            writeResponse(
                output,
                "unload",
                "RuntimeNotRunning",
                lifecycleState(state),
                injectorVersion,
                targetPid,
                targetArchitecture
            );
            return true;
        }
        try {
            String shutdown = NativeRuntimeBridge.shutdown();
            requireTokens(
                shutdown,
                Arrays.asList("shutdown=ok", "state=stopped", "workers=0")
            );
            state.shutdownComplete = true;
            writeResponse(
                output,
                "unload",
                "Stopped",
                "stopped",
                injectorVersion,
                targetPid,
                targetArchitecture
            );
        } catch (Throwable error) {
            writeResponse(
                output,
                "unload",
                "NativeShutdownFailed",
                lifecycleState(state),
                injectorVersion,
                targetPid,
                targetArchitecture
            );
        }
        return true;
    }

    private static String validateRequest(
        Map<String, String> fields,
        String operation,
        TargetConfig config,
        long targetPid,
        String targetArchitecture
    ) {
        if (!isKnownOperation(operation)) {
            return "UnsupportedOperation";
        }
        int expectedFieldCount = "load".equals(operation) ? 7 : 6;
        if (fields.size() != expectedFieldCount) {
            return "InvalidRequest";
        }
        if (!Integer.toString(PROTOCOL_VERSION).equals(
            fields.get("protocolVersion")
        )) {
            return "ProtocolVersionMismatch";
        }
        if (!TARGET_KIND.equals(fields.get("targetKind"))) {
            return "TargetKindMismatch";
        }
        if (!operation.equals(fields.get("operation"))) {
            return "OperationMismatch";
        }
        if (!constantTimeEquals(config.capability, fields.get("capability"))) {
            return "AuthorizationDenied";
        }
        if (!Long.toString(targetPid).equals(fields.get("targetPid"))) {
            return "TargetPidMismatch";
        }
        if (!targetArchitecture.equals(fields.get("targetArchitecture"))) {
            return "ArchitectureMismatch";
        }
        if ("load".equals(operation) && fields.get("runtimePath") == null) {
            return "RuntimePathInvalid";
        }
        if (!"load".equals(operation) && fields.get("runtimePath") != null) {
            return "InvalidRequest";
        }
        return null;
    }

    private static Map<String, String> parseRequest(String request) {
        if (!request.startsWith(REQUEST_PREFIX)) {
            throw new IllegalArgumentException("Unexpected request prefix");
        }
        String payload = request.substring(REQUEST_PREFIX.length());
        Map<String, String> fields = new LinkedHashMap<String, String>();
        String[] entries = payload.split(";", -1);
        for (String entry : entries) {
            int separator = entry.indexOf('=');
            if (separator <= 0 || separator == entry.length() - 1) {
                throw new IllegalArgumentException("Malformed request field");
            }
            String key = entry.substring(0, separator);
            String value = entry.substring(separator + 1);
            if (!isSafeFieldKey(key) || fields.put(key, value) != null) {
                throw new IllegalArgumentException("Invalid request field");
            }
        }
        return fields;
    }

    private static String requestedOperation(String request) {
        try {
            if (!request.startsWith(REQUEST_PREFIX)) {
                return "health";
            }
            String payload = request.substring(REQUEST_PREFIX.length());
            for (String entry : payload.split(";", -1)) {
                if (entry.startsWith("operation=")) {
                    return entry.substring("operation=".length());
                }
            }
        } catch (RuntimeException ignored) {
            // The response still uses a stable operation name for diagnostics.
        }
        return "health";
    }

    private static boolean isKnownOperation(String operation) {
        return "load".equals(operation)
            || "unload".equals(operation)
            || "health".equals(operation)
            || "stop".equals(operation);
    }

    private static void writeResponse(
        PrintWriter output,
        String operation,
        String code,
        String state,
        String injectorVersion,
        long targetPid,
        String targetArchitecture
    ) {
        output.println(
            RESPONSE_PREFIX
                + "protocolVersion=" + PROTOCOL_VERSION
                + ";targetKind=" + TARGET_KIND
                + ";operation=" + operation
                + ";targetPid=" + targetPid
                + ";targetArchitecture=" + targetArchitecture
                + ";code=" + code
                + ";injectorVersion=" + injectorVersion
                + ";nativeRuntimeVersion=" + NATIVE_RUNTIME_VERSION
                + ";javaRuntimeVersion=" + JAVA_RUNTIME_VERSION
                + ";mappingSchemaVersion=" + MAPPING_SCHEMA_VERSION
                + ";oneConfigAdapterVersion=" + ONECONFIG_ADAPTER_VERSION
                + ";artifactChecksums=" + ARTIFACT_CHECKSUMS
                + ";state=" + state
        );
        output.flush();
    }

    private static void writeDescriptor(
        File descriptor,
        long targetPid,
        int port,
        String targetArchitecture,
        String capability
    ) throws IOException {
        File parent = descriptor.getParentFile();
        if (parent == null || !parent.isDirectory()) {
            throw new IllegalStateException(
                "Descriptor parent does not exist: " + descriptor
            );
        }
        File temporary = new File(
            parent,
            descriptor.getName() + ".tmp-" + targetPid
        );
        if (temporary.exists() && !temporary.delete()) {
            throw new IOException("Unable to remove stale descriptor temporary");
        }
        String contents =
            "protocolVersion=" + PROTOCOL_VERSION + "\n"
                + "targetKind=" + TARGET_KIND + "\n"
                + "pid=" + targetPid + "\n"
                + "port=" + port + "\n"
                + "targetArchitecture=" + targetArchitecture + "\n"
                + "capability=" + capability + "\n";
        FileOutputStream stream = new FileOutputStream(temporary);
        try {
            stream.write(contents.getBytes("UTF-8"));
            stream.getFD().sync();
        } finally {
            stream.close();
        }
        if (!temporary.renameTo(descriptor)) {
            throw new IOException("Unable to publish authorized target descriptor");
        }
        descriptor.setReadable(true, true);
        descriptor.setWritable(true, true);
    }

    private static String lifecycleState(TargetState state) {
        if (!state.runtimeLoaded) {
            return "waiting";
        }
        return state.shutdownComplete ? "stopped" : "running";
    }

    private static boolean constantTimeEquals(String expected, String actual) {
        if (actual == null) {
            return false;
        }
        try {
            return MessageDigest.isEqual(
                expected.getBytes("UTF-8"),
                actual.getBytes("UTF-8")
            );
        } catch (IOException error) {
            throw new IllegalStateException("UTF-8 is unavailable", error);
        }
    }

    private static boolean isSafeFieldKey(String value) {
        if (value.isEmpty()) {
            return false;
        }
        for (int index = 0; index < value.length(); index++) {
            if (!Character.isLetterOrDigit(value.charAt(index))) {
                return false;
            }
        }
        return true;
    }

    private static String requiredField(Map<String, String> values, String field) {
        String value = values.get(field);
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalArgumentException("Missing request field: " + field);
        }
        return value;
    }

    private static String requiredProperty(String property) {
        String value = System.getProperty(property);
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalStateException("Missing -D" + property);
        }
        return value;
    }

    private static long currentPid() {
        String runtimeName = ManagementFactory.getRuntimeMXBean().getName();
        int separator = runtimeName.indexOf('@');
        String rawPid = separator >= 0
            ? runtimeName.substring(0, separator)
            : runtimeName;
        try {
            return Long.parseLong(rawPid);
        } catch (NumberFormatException error) {
            throw new IllegalStateException(
                "Unable to resolve Java process id from " + runtimeName,
                error
            );
        }
    }

    private static String normalizeArchitecture(String architecture) {
        if ("amd64".equals(architecture) || "x86_64".equals(architecture)) {
            return "x86_64";
        }
        if ("aarch64".equals(architecture) || "arm64".equals(architecture)) {
            return "arm64";
        }
        throw new IllegalStateException(
            "Unsupported target architecture: " + architecture
        );
    }

    private static void emit(String value) {
        System.out.println(value);
        System.out.flush();
    }

    private static void requireTokens(String report, List<String> requiredTokens) {
        for (String token : requiredTokens) {
            if (!report.contains(token)) {
                throw new IllegalStateException(
                    "Native runtime report is missing " + token
                );
            }
        }
    }

    private static final class TargetState {
        private boolean runtimeLoaded;
        private boolean shutdownComplete = true;
        private File loadedRuntime;
    }

    private static final class TargetConfig {
        private final String descriptor;
        private final String capability;
        private final String allowedRuntime;

        private TargetConfig(
            String descriptor,
            String capability,
            String allowedRuntime
        ) {
            this.descriptor = descriptor;
            this.capability = capability;
            this.allowedRuntime = allowedRuntime;
        }

        private static TargetConfig parse(String[] args) {
            if (args.length != 6) {
                throw new IllegalArgumentException(
                    "Expected --descriptor, --capability, and --allowed-runtime"
                );
            }
            Map<String, String> options = new LinkedHashMap<String, String>();
            for (int index = 0; index < args.length; index += 2) {
                String name = args[index];
                String value = args[index + 1];
                if (
                    !("--descriptor".equals(name)
                        || "--capability".equals(name)
                        || "--allowed-runtime".equals(name))
                    || value.trim().isEmpty()
                    || options.put(name, value) != null
                ) {
                    throw new IllegalArgumentException(
                        "Invalid authorized target option: " + name
                    );
                }
            }
            String descriptor = options.get("--descriptor");
            String capability = options.get("--capability");
            String allowedRuntime = options.get("--allowed-runtime");
            if (
                descriptor == null
                    || capability == null
                    || allowedRuntime == null
                    || !isSafeCapability(capability)
            ) {
                throw new IllegalArgumentException(
                    "Authorized target options are incomplete or invalid"
                );
            }
            return new TargetConfig(descriptor, capability, allowedRuntime);
        }

        private static boolean isSafeCapability(String capability) {
            if (capability.length() < 32 || capability.length() > 128) {
                return false;
            }
            for (int index = 0; index < capability.length(); index++) {
                char character = capability.charAt(index);
                if (
                    !(Character.isLetterOrDigit(character)
                        || character == '-'
                        || character == '_')
                ) {
                    return false;
                }
            }
            return true;
        }
    }
}
