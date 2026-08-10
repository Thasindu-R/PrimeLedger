plugins {
    // Java 21 is the target (proposal §5.1) and is rarely the JDK a contributor
    // happens to have installed. This resolver lets Gradle provision the
    // toolchain itself rather than failing the build with "no matching JDK".
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

rootProject.name = "primeledger-backend"
