package dev.opus.runtime.harness;

import dev.opus.runtime.ownedclient.OpusOwnedM3RuntimeControl;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.net.Socket;
import java.nio.file.Files;
import java.nio.file.attribute.PosixFilePermission;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.EnumSet;
import java.util.Properties;
import java.util.Set;
import java.util.jar.JarEntry;
import java.util.jar.JarOutputStream;

/**
 * Component-level proof for the OPUS-owned preview runtime-control endpoint.
 * This belongs to the preview-only ownedM3 source set.
 *
 * <p>This harness validates endpoint behavior and JNI binding names. It is not
 * a Minecraft client and must never be submitted as authorized-client
 * evidence.</p>
 */
public final class OwnedClientControlHarness {
    private static final String REQUEST_PREFIX =
        "OPUS_AUTHORIZED_TARGET_REQUEST ";
    private static final String RESPONSE_PREFIX =
        "OPUS_AUTHORIZED_TARGET_RESPONSE ";
    private static final String TARGET_KIND = "opus-owned-client";
    private static final String PREVIEW_BOOTSTRAP_ENTRY =
        "dev/opus/runtime/ownedclient/OpusOwnedM3ClientBootstrap.class";
    private static final Set<PosixFilePermission> OWNER_ONLY_FILE_PERMISSIONS =
        EnumSet.of(
            PosixFilePermission.OWNER_READ,
            PosixFilePermission.OWNER_WRITE
        );
    private static final String CAPABILITY =
        "OpusOwnedM3ControlHarnessCapability0000000000000000000000000001";

    private OwnedClientControlHarness() {
    }

    public static void main(String[] args) throws Exception {
        String runtimePath = requiredProperty("opus.runtime.library");
        File runtime = new File(runtimePath).getCanonicalFile();
        if (!runtime.isFile()) {
            throw new IllegalStateException("Native runtime library is missing");
        }

        File directory = createTemporaryDirectory();
        File descriptor = new File(directory, "owned-client.properties");
        File configuration = new File(
            directory,
            "owned-client-control.properties"
        );
        File clientBuild = new File(
            directory,
            "opus-owned-m3-bootstrap-0.1.0.jar"
        );
        String previousConfig = System.getProperty(
            OpusOwnedM3RuntimeControl.CONFIG_PROPERTY
        );
        OpusOwnedM3RuntimeControl control = null;
        try {
            writeClientBuild(clientBuild);
            writeConfiguration(
                configuration,
                descriptor,
                runtime,
                clientBuild
            );
            System.setProperty(
                OpusOwnedM3RuntimeControl.CONFIG_PROPERTY,
                configuration.getPath()
            );
            control = OpusOwnedM3RuntimeControl.startIfConfigured();
            if (control == null) {
                throw new IllegalStateException(
                    "OPUS-owned M3 control did not start"
                );
            }

            Properties target = readProperties(descriptor);
            assertOwnerOnlyFile(descriptor);
            assertResponse(
                request(target, "health", null),
                "health",
                "TargetAlive",
                "waiting"
            );
            assertResponse(
                request(target, "load", runtime),
                "load",
                "Ready",
                "running"
            );
            assertResponse(
                request(target, "health", null),
                "health",
                "TargetAlive",
                "running"
            );
            assertResponse(
                request(target, "unload", null),
                "unload",
                "Stopped",
                "stopped"
            );

            for (int cycle = 2; cycle <= 3; cycle++) {
                assertResponse(
                    request(target, "load", runtime),
                    "load",
                    "Ready",
                    "running"
                );
                assertResponse(
                    request(target, "health", null),
                    "health",
                    "TargetAlive",
                    "running"
                );
                assertResponse(
                    request(target, "unload", null),
                    "unload",
                    "Stopped",
                    "stopped"
                );
            }

            assertResponse(
                request(target, "health", null),
                "health",
                "TargetAlive",
                "stopped"
            );
            assertResponse(
                request(target, "close-game", null),
                "close-game",
                "GameCloseUnavailable",
                "stopped"
            );
            assertResponse(
                request(target, "stop", null),
                "stop",
                "TargetStopping",
                "stopped"
            );
            waitForDescriptorRemoval(descriptor);
            System.out.println(
                "OPUS_OWNED_CLIENT_CONTROL_HARNESS_PASS cycles=3"
            );
        } finally {
            if (control != null) {
                control.close();
            }
            if (previousConfig == null) {
                System.clearProperty(OpusOwnedM3RuntimeControl.CONFIG_PROPERTY);
            } else {
                System.setProperty(
                    OpusOwnedM3RuntimeControl.CONFIG_PROPERTY,
                    previousConfig
                );
            }
            deleteIfPresent(descriptor);
            deleteIfPresent(configuration);
            deleteIfPresent(clientBuild);
            deleteIfPresent(directory);
        }
    }

    private static void writeConfiguration(
        File configuration,
        File descriptor,
        File runtime,
        File clientBuild
    ) throws IOException {
        Properties values = new Properties();
        values.setProperty("protocolVersion", "1");
        values.setProperty("targetKind", TARGET_KIND);
        values.setProperty("targetVersion", "0.1.0");
        values.setProperty("clientBuild", clientBuild.getCanonicalPath());
        values.setProperty("clientBuildSha256", sha256(clientBuild));
        values.setProperty("injectorVersion", "0.1.0");
        values.setProperty("nativeRuntimeVersion", "0.1.0");
        values.setProperty("javaRuntimeVersion", "not-built");
        values.setProperty(
            "targetArchitecture",
            normalizeArchitecture(System.getProperty("os.arch"))
        );
        values.setProperty("descriptor", descriptor.getCanonicalPath());
        values.setProperty("capability", CAPABILITY);
        values.setProperty("allowedRuntime", runtime.getCanonicalPath());
        values.setProperty("allowedRuntimeSha256", sha256(runtime));
        FileOutputStream output = new FileOutputStream(configuration);
        try {
            values.store(output, "OPUS-owned M3 control harness");
        } finally {
            output.close();
        }
    }

    private static void writeClientBuild(File clientBuild) throws IOException {
        JarOutputStream output = new JarOutputStream(
            new FileOutputStream(clientBuild)
        );
        try {
            JarEntry entry = new JarEntry(PREVIEW_BOOTSTRAP_ENTRY);
            output.putNextEntry(entry);
            output.write(new byte[] {0});
            output.closeEntry();
        } finally {
            output.close();
        }
    }

    private static void assertOwnerOnlyFile(File file) throws IOException {
        if (!Files.getPosixFilePermissions(file.toPath()).equals(
            OWNER_ONLY_FILE_PERMISSIONS
        )) {
            throw new IllegalStateException(
                "OPUS-owned M3 descriptor must be owner-readable only"
            );
        }
    }

    private static Properties readProperties(File file) throws IOException {
        Properties values = new Properties();
        FileInputStream input = new FileInputStream(file);
        try {
            values.load(input);
        } finally {
            input.close();
        }
        return values;
    }

    private static String request(
        Properties descriptor,
        String operation,
        File runtime
    ) throws IOException {
        String pid = required(descriptor, "pid");
        String architecture = required(descriptor, "targetArchitecture");
        String capability = required(descriptor, "capability");
        int port = Integer.parseInt(required(descriptor, "port"));
        StringBuilder request = new StringBuilder(REQUEST_PREFIX)
            .append("protocolVersion=1")
            .append(";targetKind=").append(TARGET_KIND)
            .append(";operation=").append(operation)
            .append(";capability=").append(capability)
            .append(";targetPid=").append(pid)
            .append(";targetArchitecture=").append(architecture);
        if (runtime != null) {
            request.append(";runtimePath=")
                .append(percentEncode(runtime.getPath()));
        }

        Socket socket = new Socket("127.0.0.1", port);
        try {
            PrintWriter output = new PrintWriter(
                new OutputStreamWriter(socket.getOutputStream(), "UTF-8"),
                true
            );
            BufferedReader input = new BufferedReader(
                new InputStreamReader(socket.getInputStream(), "UTF-8")
            );
            output.println(request.toString());
            String response = input.readLine();
            if (response == null) {
                throw new IOException("OPUS-owned M3 control returned no response");
            }
            return response;
        } finally {
            socket.close();
        }
    }

    private static void assertResponse(
        String response,
        String operation,
        String code,
        String state
    ) {
        requireToken(response, RESPONSE_PREFIX);
        requireToken(response, "targetKind=" + TARGET_KIND);
        requireToken(response, "operation=" + operation);
        requireToken(response, "code=" + code);
        requireToken(response, "state=" + state);
        if (response.contains("runtime_version=never-present")) {
            throw new IllegalStateException(
                "Unexpected native report text leaked into endpoint response"
            );
        }
        requireToken(response, "nativeRuntimeVersion=0.1.0");
        requireToken(response, "javaRuntimeVersion=not-built");
        requireToken(response, "mappingSchemaVersion=not-applicable");
        requireToken(response, "oneConfigAdapterVersion=not-loaded");
    }

    private static void requireToken(String value, String token) {
        if (!value.contains(token)) {
            throw new IllegalStateException(
                "OPUS-owned M3 control response is missing " + token
            );
        }
    }

    private static void waitForDescriptorRemoval(File descriptor)
        throws InterruptedException {
        for (int attempt = 0; attempt < 40; attempt++) {
            if (!descriptor.exists()) {
                return;
            }
            Thread.sleep(25L);
        }
        throw new IllegalStateException(
            "OPUS-owned M3 control left a descriptor after stop"
        );
    }

    private static File createTemporaryDirectory() throws IOException {
        File root = File.createTempFile("opus-owned-m3-control-", "");
        if (!root.delete() || !root.mkdir()) {
            throw new IOException(
                "Unable to create OPUS-owned M3 control temporary directory"
            );
        }
        return root;
    }

    private static void deleteIfPresent(File file) {
        if (file.exists() && !file.delete()) {
            throw new IllegalStateException(
                "Unable to remove OPUS-owned M3 control temporary artifact"
            );
        }
    }

    private static String requiredProperty(String key) {
        String value = System.getProperty(key);
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalStateException("Missing -D" + key);
        }
        return value;
    }

    private static String required(Properties values, String key) {
        String value = values.getProperty(key);
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalStateException(
                "OPUS-owned M3 descriptor is missing " + key
            );
        }
        return value;
    }

    private static String normalizeArchitecture(String architecture) {
        if ("amd64".equals(architecture) || "x86_64".equals(architecture)) {
            return "x86_64";
        }
        if ("aarch64".equals(architecture) || "arm64".equals(architecture)) {
            return "arm64";
        }
        throw new IllegalStateException("Unsupported control harness architecture");
    }

    private static String percentEncode(String value) {
        StringBuilder encoded = new StringBuilder(value.length());
        byte[] bytes;
        try {
            bytes = value.getBytes("UTF-8");
        } catch (IOException error) {
            throw new IllegalStateException("UTF-8 is unavailable", error);
        }
        for (byte raw : bytes) {
            int valueByte = raw & 0xff;
            if ((valueByte >= 'a' && valueByte <= 'z')
                || (valueByte >= 'A' && valueByte <= 'Z')
                || (valueByte >= '0' && valueByte <= '9')
                || valueByte == '-'
                || valueByte == '_'
                || valueByte == '.'
                || valueByte == '~') {
                encoded.append((char) valueByte);
            } else {
                encoded.append('%');
                encoded.append(hexDigit(valueByte >>> 4));
                encoded.append(hexDigit(valueByte & 0x0f));
            }
        }
        return encoded.toString();
    }

    private static char hexDigit(int value) {
        return (char) (value < 10 ? '0' + value : 'A' + (value - 10));
    }

    private static String sha256(File file) throws IOException {
        MessageDigest digest;
        try {
            digest = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException("SHA-256 is unavailable", error);
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
        StringBuilder result = new StringBuilder(64);
        for (byte value : digest.digest()) {
            result.append(String.format("%02x", value & 0xff));
        }
        return result.toString();
    }
}
