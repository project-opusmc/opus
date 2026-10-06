package dev.opus.runtime.ownedclient;

import dev.opus.runtime.bridge.NativeRuntimeBridge;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.lang.reflect.Field;
import java.lang.management.ManagementFactory;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketException;
import java.net.SocketTimeoutException;
import java.net.URLDecoder;
import java.nio.file.Files;
import java.nio.file.attribute.PosixFilePermission;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.jar.JarFile;

/**
 * Explicit loopback-only runtime control for the source-controlled OPUS-owned
 * M3 preview target.
 *
 * <p>The endpoint is disabled unless the launcher supplies a private
 * configuration file through {@link #CONFIG_PROPERTY}. It self-loads one
 * startup-authorized native runtime path only; it is not a process injector,
 * an attach service, or a third-party-client integration mechanism.</p>
 */
public final class OpusOwnedM3RuntimeControl implements AutoCloseable {
    public static final String CONFIG_PROPERTY = "opus.m3.runtime-control.config";

    private static final int PROTOCOL_VERSION = 1;
    private static final int SOCKET_TIMEOUT_MILLIS = 1000;
    private static final int MAX_REQUEST_LENGTH = 4096;
    private static final int MAX_CONFIG_BYTES = 8192;
    private static final String TARGET_KIND = "opus-owned-client";
    private static final String PREVIEW_BOOTSTRAP_ENTRY =
        "dev/opus/runtime/ownedclient/OpusOwnedM3ClientBootstrap.class";
    private static final Set<PosixFilePermission> OWNER_ONLY_FILE_PERMISSIONS =
        EnumSet.of(
            PosixFilePermission.OWNER_READ,
            PosixFilePermission.OWNER_WRITE
        );
    private static final String REQUEST_PREFIX =
        "OPUS_AUTHORIZED_TARGET_REQUEST ";
    private static final String RESPONSE_PREFIX =
        "OPUS_AUTHORIZED_TARGET_RESPONSE ";
    private static final String MAPPING_SCHEMA_VERSION = "not-applicable";
    private static final String ONECONFIG_ADAPTER_VERSION = "not-loaded";
    private static final String ARTIFACT_CHECKSUMS = "not-packaged";

    private final TargetConfig config;
    private final File descriptor;
    private final ServerSocket server;
    private final long targetPid;
    private final String targetArchitecture;
    private final TargetState state = new TargetState();
    private final Thread serverThread;
    private volatile boolean accepting = true;
    private volatile boolean descriptorRemoved;

    private OpusOwnedM3RuntimeControl(
        TargetConfig config,
        ServerSocket server,
        long targetPid,
        String targetArchitecture
    ) {
        this.config = config;
        this.descriptor = config.descriptor;
        this.server = server;
        this.targetPid = targetPid;
        this.targetArchitecture = targetArchitecture;
        this.serverThread = new Thread(
            new Runnable() {
                @Override
                public void run() {
                    serve();
                }
            },
            "opus-owned-m3-runtime-control"
        );
        this.serverThread.setDaemon(true);
    }

    /**
     * Starts the endpoint only when the preview launcher has explicitly opted
     * in through a private per-session configuration file.
     *
     * @return the running endpoint, or {@code null} when the preview was not
     *     requested for this process
     */
    public static OpusOwnedM3RuntimeControl startIfConfigured()
        throws IOException {
        String rawConfigPath = System.getProperty(CONFIG_PROPERTY);
        if (rawConfigPath == null || rawConfigPath.trim().isEmpty()) {
            return null;
        }

        TargetConfig config = TargetConfig.load(new File(rawConfigPath));
        String actualArchitecture = normalizeArchitecture(
            System.getProperty("os.arch")
        );
        if (!actualArchitecture.equals(config.targetArchitecture)) {
            throw new IllegalStateException(
                "OPUS-owned M3 target architecture does not match its launch "
                    + "configuration"
            );
        }

        long targetPid = currentPid();
        if (config.descriptor.exists()) {
            throw new IllegalStateException(
                "OPUS-owned M3 target descriptor already exists"
            );
        }

        ServerSocket server = new ServerSocket(
            0,
            8,
            InetAddress.getByName("127.0.0.1")
        );
        server.setSoTimeout(SOCKET_TIMEOUT_MILLIS);
        OpusOwnedM3RuntimeControl control =
            new OpusOwnedM3RuntimeControl(
                config,
                server,
                targetPid,
                actualArchitecture
            );
        try {
            control.publishDescriptor();
            control.serverThread.start();
            emit(
                "[OPUS/M3-OWNED] runtime-control ready "
                    + "targetPid=" + targetPid
                    + " targetArchitecture=" + actualArchitecture
            );
            return control;
        } catch (RuntimeException error) {
            control.close();
            throw error;
        } catch (IOException error) {
            control.close();
            throw error;
        }
    }

    @Override
    public void close() {
        synchronized (state) {
            if (state.runtimeLoaded && !state.shutdownComplete) {
                try {
                    String shutdown = NativeRuntimeBridge.shutdown();
                    requireTokens(
                        shutdown,
                        Arrays.asList(
                            "shutdown=ok",
                            "state=stopped",
                            "workers=0"
                        )
                    );
                    state.shutdownComplete = true;
                } catch (Throwable error) {
                    emit(
                        "[OPUS/M3-OWNED] WARN runtime shutdown did not "
                            + "complete during target close"
                    );
                }
            }
        }

        accepting = false;
        closeServer();
        if (Thread.currentThread() != serverThread) {
            try {
                serverThread.join(SOCKET_TIMEOUT_MILLIS * 2L);
            } catch (InterruptedException error) {
                Thread.currentThread().interrupt();
            }
        }
        removeDescriptor();
    }

    private void serve() {
        try {
            while (accepting) {
                try {
                    Socket socket = server.accept();
                    try {
                        handleConnection(socket);
                    } finally {
                        socket.close();
                    }
                } catch (SocketTimeoutException ignored) {
                    // Periodically observe an explicit stop or game shutdown.
                } catch (SocketException error) {
                    if (accepting) {
                        emit(
                            "[OPUS/M3-OWNED] WARN runtime-control socket "
                                + "closed unexpectedly"
                        );
                    }
                    return;
                }
            }
        } catch (IOException error) {
            if (accepting) {
                emit(
                    "[OPUS/M3-OWNED] WARN runtime-control listener failed"
                );
            }
        } finally {
            accepting = false;
            closeServer();
            removeDescriptor();
        }
    }

    private void handleConnection(Socket socket) throws IOException {
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
            writeResponse(output, "health", "InvalidRequest", lifecycleState());
            return;
        }
        if (!socket.getInetAddress().isLoopbackAddress()) {
            writeResponse(
                output,
                requestedOperation(request),
                "PeerNotAllowed",
                lifecycleState()
            );
            return;
        }

        String operation = requestedOperation(request);
        try {
            Map<String, String> fields = parseRequest(request);
            String validationCode = validateRequest(fields, operation);
            if (validationCode != null) {
                writeResponse(
                    output,
                    operation,
                    validationCode,
                    lifecycleState()
                );
                return;
            }

            if ("load".equals(operation)) {
                handleLoad(output, fields);
            } else if ("unload".equals(operation)) {
                handleUnload(output);
            } else if ("health".equals(operation)) {
                writeResponse(
                    output,
                    operation,
                    "TargetAlive",
                    lifecycleState()
                );
            } else if ("stop".equals(operation)) {
                handleStop(output);
            } else if ("close-game".equals(operation)) {
                handleGameClose(output);
            } else {
                writeResponse(
                    output,
                    operation,
                    "UnsupportedOperation",
                    lifecycleState()
                );
            }
        } catch (RuntimeException error) {
            writeResponse(
                output,
                operation,
                "InvalidRequest",
                lifecycleState()
            );
        }
    }

    private void handleLoad(
        PrintWriter output,
        Map<String, String> fields
    ) {
        synchronized (state) {
            File requestedRuntime;
            try {
                requestedRuntime = new File(
                    URLDecoder.decode(
                        requiredField(fields, "runtimePath"),
                        "UTF-8"
                    )
                ).getCanonicalFile();
            } catch (Exception error) {
                writeResponse(
                    output,
                    "load",
                    "RuntimePathInvalid",
                    lifecycleStateLocked()
                );
                return;
            }

            if (!config.allowedRuntime.equals(requestedRuntime)) {
                writeResponse(
                    output,
                    "load",
                    "RuntimePathNotAuthorized",
                    lifecycleStateLocked()
                );
                return;
            }
            if (state.runtimeLoaded && !state.shutdownComplete) {
                writeResponse(
                    output,
                    "load",
                    "RuntimeAlreadyRunning",
                    lifecycleStateLocked()
                );
                return;
            }

            try {
                String probe;
                if (!state.runtimeLoaded) {
                    System.load(requestedRuntime.getPath());
                    state.runtimeLoaded = true;
                    state.loadedRuntime = requestedRuntime;
                    state.shutdownComplete = false;
                    probe = NativeRuntimeBridge.probe();
                } else if (!requestedRuntime.equals(state.loadedRuntime)) {
                    writeResponse(
                        output,
                        "load",
                        "RuntimePathNotAuthorized",
                        lifecycleStateLocked()
                    );
                    return;
                } else {
                    probe = NativeRuntimeBridge.restart();
                    state.shutdownComplete = false;
                }
                requireTokens(
                    probe,
                    Arrays.asList(
                        "runtime_version=" + config.nativeRuntimeVersion,
                        "vm_discovery=ok",
                        "jni=ok",
                        "jvmti=ok",
                        "worker_attach_detach=ok",
                        "state=running"
                    )
                );
                writeResponse(output, "load", "Ready", "running");
            } catch (Throwable error) {
                if (state.runtimeLoaded && !state.shutdownComplete) {
                    try {
                        NativeRuntimeBridge.shutdown();
                        state.shutdownComplete = true;
                    } catch (Throwable ignored) {
                        // The typed response below is the only external detail.
                    }
                }
                writeResponse(
                    output,
                    "load",
                    "NativeEntryFailed",
                    lifecycleStateLocked()
                );
            }
        }
    }

    private void handleUnload(PrintWriter output) {
        synchronized (state) {
            if (!state.runtimeLoaded || state.shutdownComplete) {
                writeResponse(
                    output,
                    "unload",
                    "RuntimeNotRunning",
                    lifecycleStateLocked()
                );
                return;
            }
            try {
                String shutdown = NativeRuntimeBridge.shutdown();
                requireTokens(
                    shutdown,
                    Arrays.asList(
                        "shutdown=ok",
                        "state=stopped",
                        "workers=0"
                    )
                );
                state.shutdownComplete = true;
                writeResponse(output, "unload", "Stopped", "stopped");
            } catch (Throwable error) {
                writeResponse(
                    output,
                    "unload",
                    "NativeShutdownFailed",
                    lifecycleStateLocked()
                );
            }
        }
    }

    private void handleStop(PrintWriter output) {
        synchronized (state) {
            if (state.runtimeLoaded && !state.shutdownComplete) {
                writeResponse(
                    output,
                    "stop",
                    "ShutdownRequired",
                    lifecycleStateLocked()
                );
                return;
            }
        }
        writeResponse(output, "stop", "TargetStopping", "stopped");
        accepting = false;
        closeServer();
    }

    /**
     * Requests the existing LWJGL window-close latch inside this exact
     * OPUS-owned game JVM. This is intentionally narrower than a process
     * signal: the Minecraft loop still observes {@code isCloseRequested()}
     * and performs its ordinary close path.
     */
    private void handleGameClose(PrintWriter output) {
        synchronized (state) {
            if (state.runtimeLoaded && !state.shutdownComplete) {
                writeResponse(
                    output,
                    "close-game",
                    "ShutdownRequired",
                    lifecycleStateLocked()
                );
                return;
            }
            try {
                GameWindowCloseRequest closeRequest =
                    GameWindowCloseRequest.resolve();
                closeRequest.request();
                writeResponse(
                    output,
                    "close-game",
                    "GameCloseRequested",
                    "stopped"
                );
            } catch (ReflectiveOperationException | RuntimeException
                | LinkageError error) {
                writeResponse(
                    output,
                    "close-game",
                    "GameCloseUnavailable",
                    lifecycleStateLocked()
                );
            }
        }
    }

    private String validateRequest(
        Map<String, String> fields,
        String operation
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

    private void writeResponse(
        PrintWriter output,
        String operation,
        String code,
        String lifecycleState
    ) {
        output.println(
            RESPONSE_PREFIX
                + "protocolVersion=" + PROTOCOL_VERSION
                + ";targetKind=" + TARGET_KIND
                + ";operation=" + operation
                + ";targetPid=" + targetPid
                + ";targetArchitecture=" + targetArchitecture
                + ";code=" + code
                + ";injectorVersion=" + config.injectorVersion
                + ";nativeRuntimeVersion=" + config.nativeRuntimeVersion
                + ";javaRuntimeVersion=" + config.javaRuntimeVersion
                + ";mappingSchemaVersion=" + MAPPING_SCHEMA_VERSION
                + ";oneConfigAdapterVersion=" + ONECONFIG_ADAPTER_VERSION
                + ";artifactChecksums=" + ARTIFACT_CHECKSUMS
                + ";state=" + lifecycleState
        );
        output.flush();
    }

    private void publishDescriptor() throws IOException {
        File parent = descriptor.getParentFile();
        if (parent == null || !parent.isDirectory()) {
            throw new IOException("OPUS-owned M3 descriptor parent is unavailable");
        }
        File temporary = new File(
            parent,
            descriptor.getName() + ".tmp-" + targetPid
        );
        if (!temporary.createNewFile()) {
            throw new IOException("OPUS-owned M3 descriptor temporary exists");
        }
        boolean published = false;
        try {
            restrictFileToOwner(temporary);
            String contents =
                "protocolVersion=" + PROTOCOL_VERSION + "\n"
                    + "targetKind=" + TARGET_KIND + "\n"
                    + "pid=" + targetPid + "\n"
                    + "port=" + server.getLocalPort() + "\n"
                    + "targetArchitecture=" + targetArchitecture + "\n"
                    + "capability=" + config.capability + "\n";
            FileOutputStream stream = new FileOutputStream(temporary);
            try {
                stream.write(contents.getBytes("UTF-8"));
                stream.getFD().sync();
            } finally {
                stream.close();
            }
            if (!temporary.renameTo(descriptor)) {
                throw new IOException("Unable to publish OPUS-owned M3 descriptor");
            }
            published = true;
            restrictFileToOwner(descriptor);
        } finally {
            if (!published && temporary.exists()) {
                temporary.delete();
            }
        }
    }

    private static void restrictFileToOwner(File file) throws IOException {
        Files.setPosixFilePermissions(
            file.toPath(),
            OWNER_ONLY_FILE_PERMISSIONS
        );
    }

    private void removeDescriptor() {
        if (descriptorRemoved) {
            return;
        }
        descriptorRemoved = true;
        if (descriptor.exists() && !descriptor.delete()) {
            emit("[OPUS/M3-OWNED] WARN unable to remove runtime-control descriptor");
        }
    }

    private void closeServer() {
        try {
            server.close();
        } catch (IOException ignored) {
            // Closing is best effort during the target's own shutdown.
        }
    }

    private String lifecycleState() {
        synchronized (state) {
            return lifecycleStateLocked();
        }
    }

    private String lifecycleStateLocked() {
        if (!state.runtimeLoaded) {
            return "waiting";
        }
        return state.shutdownComplete ? "stopped" : "running";
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
            // Keep diagnostics stable for malformed loopback requests.
        }
        return "health";
    }

    private static boolean isKnownOperation(String operation) {
        return "load".equals(operation)
            || "unload".equals(operation)
            || "health".equals(operation)
            || "stop".equals(operation)
            || "close-game".equals(operation);
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

    private static String requiredField(
        Map<String, String> values,
        String field
    ) {
        String value = values.get(field);
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalArgumentException("Missing request field");
        }
        return value;
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
                "Unable to resolve OPUS-owned M3 target process id",
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
            "Unsupported OPUS-owned M3 target architecture"
        );
    }

    private static void requireTokens(
        String report,
        List<String> requiredTokens
    ) {
        for (String token : requiredTokens) {
            if (!report.contains(token)) {
                throw new IllegalStateException(
                    "Native runtime report is missing required lifecycle data"
                );
            }
        }
    }

    private static void emit(String value) {
        System.out.println(value);
        System.out.flush();
    }

    private static final class TargetState {
        private boolean runtimeLoaded;
        private boolean shutdownComplete = true;
        private File loadedRuntime;
    }

    /**
     * Resolves only the known LWJGL 2 implementation that this OPUS-owned
     * preview launched on its own classpath. It does not select, attach to,
     * or alter any other process.
     */
    private static final class GameWindowCloseRequest {
        private static final String DISPLAY_CLASS =
            "org.lwjgl.opengl.Display";
        private static final String DISPLAY_IMPLEMENTATION_FIELD =
            "display_impl";
        private static final String MACOS_DISPLAY_CLASS =
            "org.lwjgl.opengl.MacOSXDisplay";
        private static final String CLOSE_REQUESTED_FIELD =
            "close_requested";

        private final Object displayImplementation;
        private final Field closeRequested;

        private GameWindowCloseRequest(
            Object displayImplementation,
            Field closeRequested
        ) {
            this.displayImplementation = displayImplementation;
            this.closeRequested = closeRequested;
        }

        private static GameWindowCloseRequest resolve()
            throws ReflectiveOperationException {
            ClassLoader loader =
                OpusOwnedM3RuntimeControl.class.getClassLoader();
            Class<?> display = Class.forName(DISPLAY_CLASS, false, loader);
            Field implementationField = display.getDeclaredField(
                DISPLAY_IMPLEMENTATION_FIELD
            );
            implementationField.setAccessible(true);
            Object implementation = implementationField.get(null);
            if (implementation == null
                || !MACOS_DISPLAY_CLASS.equals(
                    implementation.getClass().getName()
                )) {
                throw new IllegalStateException(
                    "OPUS-owned preview has no active macOS LWJGL display"
                );
            }
            Field closeRequested = implementation.getClass().getDeclaredField(
                CLOSE_REQUESTED_FIELD
            );
            closeRequested.setAccessible(true);
            return new GameWindowCloseRequest(
                implementation,
                closeRequested
            );
        }

        private void request() throws IllegalAccessException {
            synchronized (displayImplementation) {
                closeRequested.setBoolean(displayImplementation, true);
            }
        }
    }

    private static final class TargetConfig {
        private static final Set<String> REQUIRED_FIELDS =
            new HashSet<String>(
                Arrays.asList(
                    "protocolVersion",
                    "targetKind",
                    "targetVersion",
                    "clientBuild",
                    "clientBuildSha256",
                    "injectorVersion",
                    "nativeRuntimeVersion",
                    "javaRuntimeVersion",
                    "targetArchitecture",
                    "descriptor",
                    "capability",
                    "allowedRuntime",
                    "allowedRuntimeSha256"
                )
            );

        private final String injectorVersion;
        private final String nativeRuntimeVersion;
        private final String javaRuntimeVersion;
        private final String targetArchitecture;
        private final File descriptor;
        private final String capability;
        private final File allowedRuntime;

        private TargetConfig(
            String injectorVersion,
            String nativeRuntimeVersion,
            String javaRuntimeVersion,
            String targetArchitecture,
            File descriptor,
            String capability,
            File allowedRuntime
        ) {
            this.injectorVersion = injectorVersion;
            this.nativeRuntimeVersion = nativeRuntimeVersion;
            this.javaRuntimeVersion = javaRuntimeVersion;
            this.targetArchitecture = targetArchitecture;
            this.descriptor = descriptor;
            this.capability = capability;
            this.allowedRuntime = allowedRuntime;
        }

        private static TargetConfig load(File requestedConfig)
            throws IOException {
            File configFile = requestedConfig.getCanonicalFile();
            if (!configFile.isFile()
                || configFile.length() == 0L
                || configFile.length() > MAX_CONFIG_BYTES) {
                throw new IllegalStateException(
                    "OPUS-owned M3 runtime-control configuration is invalid"
                );
            }

            Properties properties = new Properties();
            FileInputStream stream = new FileInputStream(configFile);
            try {
                properties.load(stream);
            } finally {
                stream.close();
            }
            if (!properties.stringPropertyNames().equals(REQUIRED_FIELDS)) {
                throw new IllegalStateException(
                    "OPUS-owned M3 runtime-control configuration fields are invalid"
                );
            }
            if (!Integer.toString(PROTOCOL_VERSION).equals(
                requiredProperty(properties, "protocolVersion")
            ) || !TARGET_KIND.equals(
                requiredProperty(properties, "targetKind")
            )) {
                throw new IllegalStateException(
                    "OPUS-owned M3 runtime-control protocol is incompatible"
                );
            }

            String targetVersion = requiredProperty(
                properties,
                "targetVersion"
            );
            if (!isSemanticVersion(targetVersion)) {
                throw new IllegalStateException(
                    "OPUS-owned M3 preview target version is invalid"
                );
            }
            File clientBuild = new File(
                requiredProperty(properties, "clientBuild")
            ).getCanonicalFile();
            String clientBuildChecksum = requiredProperty(
                properties,
                "clientBuildSha256"
            );
            if (!clientBuild.isFile()
                || !isExpectedClientBuild(clientBuild, targetVersion)
                || !isSha256(clientBuildChecksum)
                || !clientBuildChecksum.equals(sha256(clientBuild))) {
                throw new IllegalStateException(
                    "OPUS-owned M3 preview client build did not match its launch configuration"
                );
            }

            String injectorVersion = requiredProperty(
                properties,
                "injectorVersion"
            );
            String nativeRuntimeVersion = requiredProperty(
                properties,
                "nativeRuntimeVersion"
            );
            String javaRuntimeVersion = requiredProperty(
                properties,
                "javaRuntimeVersion"
            );
            if (!isSafeVersion(injectorVersion)
                || !isSafeVersion(nativeRuntimeVersion)
                || !"not-built".equals(javaRuntimeVersion)) {
                throw new IllegalStateException(
                    "OPUS-owned M3 runtime-control versions are invalid"
                );
            }

            String targetArchitecture = requiredProperty(
                properties,
                "targetArchitecture"
            );
            if (!"arm64".equals(targetArchitecture)
                && !"x86_64".equals(targetArchitecture)) {
                throw new IllegalStateException(
                    "OPUS-owned M3 target architecture is invalid"
                );
            }

            File descriptor = new File(
                requiredProperty(properties, "descriptor")
            ).getCanonicalFile();
            File descriptorParent = descriptor.getParentFile();
            File configParent = configFile.getParentFile();
            if (descriptorParent == null
                || configParent == null
                || !descriptorParent.equals(configParent)
                || !descriptorParent.isDirectory()) {
                throw new IllegalStateException(
                    "OPUS-owned M3 descriptor must remain in the private session directory"
                );
            }

            String capability = requiredProperty(properties, "capability");
            if (!isSafeCapability(capability)) {
                throw new IllegalStateException(
                    "OPUS-owned M3 runtime-control capability is invalid"
                );
            }

            File allowedRuntime = new File(
                requiredProperty(properties, "allowedRuntime")
            ).getCanonicalFile();
            String expectedChecksum = requiredProperty(
                properties,
                "allowedRuntimeSha256"
            );
            if (!allowedRuntime.isFile()
                || !isSha256(expectedChecksum)
                || !expectedChecksum.equals(sha256(allowedRuntime))) {
                throw new IllegalStateException(
                    "OPUS-owned M3 runtime artifact did not match its launch configuration"
                );
            }

            return new TargetConfig(
                injectorVersion,
                nativeRuntimeVersion,
                javaRuntimeVersion,
                targetArchitecture,
                descriptor,
                capability,
                allowedRuntime
            );
        }

        private static String requiredProperty(
            Properties properties,
            String key
        ) {
            String value = properties.getProperty(key);
            if (value == null || value.trim().isEmpty()) {
                throw new IllegalStateException(
                    "OPUS-owned M3 runtime-control property is missing"
                );
            }
            return value;
        }

        private static boolean isSafeCapability(String value) {
            if (value.length() < 32 || value.length() > 128) {
                return false;
            }
            for (int index = 0; index < value.length(); index++) {
                char character = value.charAt(index);
                if (!(Character.isLetterOrDigit(character)
                    || character == '-'
                    || character == '_')) {
                    return false;
                }
            }
            return true;
        }

        private static boolean isSafeVersion(String value) {
            if (value.length() > 64 || value.isEmpty()) {
                return false;
            }
            boolean hasDigit = false;
            for (int index = 0; index < value.length(); index++) {
                char character = value.charAt(index);
                if (Character.isDigit(character)) {
                    hasDigit = true;
                } else if (!(Character.isLetter(character)
                    || character == '.'
                    || character == '-'
                    || character == '+')) {
                    return false;
                }
            }
            return hasDigit;
        }

        private static boolean isSemanticVersion(String value) {
            return value.matches(
                "[0-9]+\\.[0-9]+\\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?"
            );
        }

        private static boolean isExpectedClientBuild(
            File clientBuild,
            String targetVersion
        ) {
            if (!(
                "opus-owned-m3-bootstrap-" + targetVersion + ".jar"
            ).equals(clientBuild.getName())) {
                return false;
            }
            try {
                JarFile archive = new JarFile(clientBuild);
                try {
                    return archive.getJarEntry(PREVIEW_BOOTSTRAP_ENTRY) != null;
                } finally {
                    archive.close();
                }
            } catch (IOException ignored) {
                return false;
            }
        }

        private static boolean isSha256(String value) {
            if (value.length() != 64) {
                return false;
            }
            for (int index = 0; index < value.length(); index++) {
                char character = value.charAt(index);
                if (!((character >= '0' && character <= '9')
                    || (character >= 'a' && character <= 'f'))) {
                    return false;
                }
            }
            return true;
        }

        private static String sha256(File file) throws IOException {
            MessageDigest digest;
            try {
                digest = MessageDigest.getInstance("SHA-256");
            } catch (NoSuchAlgorithmException error) {
                throw new IllegalStateException(
                    "SHA-256 is unavailable",
                    error
                );
            }
            FileInputStream input = new FileInputStream(file);
            try {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = input.read(buffer)) >= 0) {
                    digest.update(buffer, 0, read);
                }
            } finally {
                input.close();
            }
            StringBuilder output = new StringBuilder(64);
            for (byte value : digest.digest()) {
                output.append(String.format("%02x", value & 0xff));
            }
            return output.toString();
        }
    }
}
