plugins {
    java
}

group = "dev.opus"
version = "0.1.0"

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(17))
    }
}

tasks.withType<JavaCompile>().configureEach {
    options.release.set(8)
    options.encoding = "UTF-8"
    options.compilerArgs.addAll(listOf("-Xlint:all", "-Werror"))
}

val ownedM3 = sourceSets.create("ownedM3") {
    java.srcDir("src/owned-m3/java")
}
ownedM3.compileClasspath += sourceSets.main.get().output
ownedM3.runtimeClasspath += sourceSets.main.get().output

tasks.register<Jar>("ownedM3BootstrapJar") {
    group = "build"
    description = "Builds the source-controlled OPUS-owned M3 preview bootstrap."
    archiveBaseName.set("opus-owned-m3-bootstrap")
    from(sourceSets.main.get().output)
    from(ownedM3.output)
    manifest {
        attributes[
            "Main-Class"
        ] = "dev.opus.runtime.ownedclient.OpusOwnedM3ClientBootstrap"
    }
}

tasks.register<Jar>("attachHarnessJar") {
    group = "build"
    description = "Builds the test-only Java Attach API harness helper."
    archiveBaseName.set("opus-attach-harness")
    from(sourceSets.main.get().output) {
        include("dev/opus/runtime/harness/AttachHarnessMain.class")
    }
    manifest {
        attributes[
            "Main-Class"
        ] = "dev.opus.runtime.harness.AttachHarnessMain"
    }
}
