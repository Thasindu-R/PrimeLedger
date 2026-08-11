import org.springframework.boot.gradle.plugin.SpringBootPlugin

buildscript {
    dependencies {
        // The Flyway Gradle plugin ships without database support; Postgres has
        // to be on the plugin's own classpath or `flywayMigrate` cannot resolve
        // a jdbc:postgresql URL.
        classpath("org.flywaydb:flyway-database-postgresql:13.2.0")
    }
    repositories {
        mavenCentral()
    }
}

plugins {
    java
    jacoco
    id("org.springframework.boot") version "4.1.0"
    id("org.flywaydb.flyway") version "13.2.0"
}

group = "com.primeledger"
version = "0.3.0"
description = "PrimeLedger REST API"

val mapstructVersion = "1.6.3"
val lombokMapstructBindingVersion = "0.2.0"
val springdocVersion = "3.1.0"

java {
    toolchain {
        // Java 21 LTS, not whichever JDK happens to be on the developer's PATH
        // (proposal §5.1). The foojay resolver in settings.gradle.kts fetches it
        // if it is missing.
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories {
    mavenCentral()
}

// Testcontainers integration tests live in their own source set so `./gradlew
// test` stays fast and Docker-free and `./gradlew integrationTest` is the
// deliberate, slower run (proposal §A.3).
val integrationTest: SourceSet =
    sourceSets.create("integrationTest") {
        compileClasspath += sourceSets.main.get().output
        runtimeClasspath += sourceSets.main.get().output
    }

// The integrationTest source set inherits the unit-test dependencies rather than
// repeating them.
configurations.named("integrationTestImplementation") {
    extendsFrom(configurations.testImplementation.get())
}
configurations.named("integrationTestRuntimeOnly") {
    extendsFrom(configurations.testRuntimeOnly.get())
}
configurations.named("integrationTestCompileOnly") {
    extendsFrom(configurations.testCompileOnly.get())
}
configurations.named("integrationTestAnnotationProcessor") {
    extendsFrom(configurations.testAnnotationProcessor.get())
}

dependencies {
    // The BOM has to reach every configuration that resolves a dependency, not
    // just `implementation` — an annotation processor declared without a version
    // fails to resolve otherwise.
    listOf(
                "implementation",
                "annotationProcessor",
                "compileOnly",
                "testImplementation",
                "testAnnotationProcessor",
                "testCompileOnly",
                "integrationTestImplementation",
                "integrationTestAnnotationProcessor",
                "integrationTestCompileOnly",
            )
            .forEach { add(it, platform(SpringBootPlugin.BOM_COORDINATES)) }

    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-actuator")

    // Phase 3. The resource server validates Supabase's RS256 tokens against the
    // published JWKS; no session, no shared secret, no call to Supabase per
    // request (proposal §9.2).
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-oauth2-resource-server")

    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:$springdocVersion")

    // The starter, not bare flyway-core: Spring Boot 4 moved Flyway's
    // auto-configuration into its own module, so the library alone is on the
    // classpath and never runs.
    implementation("org.springframework.boot:spring-boot-starter-flyway")
    runtimeOnly("org.flywaydb:flyway-database-postgresql")
    runtimeOnly("org.postgresql:postgresql")

    implementation("org.mapstruct:mapstruct:$mapstructVersion")
    annotationProcessor("org.mapstruct:mapstruct-processor:$mapstructVersion")

    compileOnly("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok")
    // Ordering guard. Without it the MapStruct processor runs before Lombok has
    // generated accessors, and every mapping silently produces nulls.
    annotationProcessor("org.projectlombok:lombok-mapstruct-binding:$lombokMapstructBindingVersion")

    testCompileOnly("org.projectlombok:lombok")
    testAnnotationProcessor("org.projectlombok:lombok")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    // Spring Boot 4 moved the @WebMvcTest slice out of the core test starter and
    // into its own module.
    testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
    testImplementation("org.springframework.security:spring-security-test")
    // Signs throwaway RS256 tokens in tests so the resource server can be
    // exercised without a Supabase project (see JwtTestTokens).
    testImplementation("com.nimbusds:nimbus-jose-jwt")

    "integrationTestCompileOnly"("org.projectlombok:lombok")
    "integrationTestAnnotationProcessor"("org.projectlombok:lombok")
    "integrationTestImplementation"("org.springframework.boot:spring-boot-testcontainers")
    // Testcontainers 2.x prefixes its module artifacts; the old
    // org.testcontainers:postgresql coordinates no longer resolve.
    "integrationTestImplementation"("org.testcontainers:testcontainers-junit-jupiter")
    "integrationTestImplementation"("org.testcontainers:testcontainers-postgresql")
    "integrationTestRuntimeOnly"("org.postgresql:postgresql")
    "integrationTestRuntimeOnly"("org.flywaydb:flyway-database-postgresql")
}

// The role-provisioning script is shared by docker-compose and Testcontainers.
// Copying it onto the integrationTest classpath rather than keeping a second
// copy means the two cannot drift into disagreeing about the password.
tasks.named<ProcessResources>("processIntegrationTestResources") {
    from(file("../docker/postgres-init")) {
        into("db/local")
    }
}

tasks.withType<JavaCompile>().configureEach {
    options.encoding = "UTF-8"
    // Keeps parameter names for Spring's binding and for springdoc.
    options.compilerArgs.add("-parameters")
}

// MapStruct only processes the main source set; passing its options to the test
// compilations just produces "not recognized by any processor" warnings.
tasks.named<JavaCompile>("compileJava") {
    options.compilerArgs.addAll(
        listOf(
            "-Amapstruct.defaultComponentModel=spring",
            // An unmapped target field is a silent null in production; fail the
            // build instead.
            "-Amapstruct.unmappedTargetPolicy=ERROR",
        ),
    )
}

tasks.named<Test>("test") {
    useJUnitPlatform()
}

val integrationTestTask = tasks.register<Test>("integrationTest") {
    description = "Runs the Testcontainers suite against a real PostgreSQL."
    group = "verification"
    testClassesDirs = integrationTest.output.classesDirs
    classpath = integrationTest.runtimeClasspath
    useJUnitPlatform()
    shouldRunAfter(tasks.named("test"))
}

tasks.named("check") {
    dependsOn(integrationTestTask)
}

jacoco {
    toolVersion = "0.8.13"
}

tasks.named<JacocoReport>("jacocoTestReport") {
    dependsOn(tasks.named("test"), integrationTestTask)
    executionData.setFrom(fileTree(layout.buildDirectory).include("jacoco/*.exec"))
    reports {
        xml.required = true
        html.required = true
    }
}

tasks.named<JacocoCoverageVerification>("jacocoTestCoverageVerification") {
    dependsOn(tasks.named("jacocoTestReport"))
    executionData.setFrom(fileTree(layout.buildDirectory).include("jacoco/*.exec"))
    violationRules {
        rule {
            // CI fails under 70% (proposal §13.2).
            limit { minimum = "0.70".toBigDecimal() }
            excludes = listOf(
                "com.primeledger.PrimeLedgerApplication",
                "com.primeledger.config.*",
            )
        }
    }
}

// `./gradlew flywayMigrate` against the local stack (proposal §A.3). The running
// application migrates itself on start-up; this task exists for applying a
// migration without booting the API.
flyway {
    url = System.getenv("DATABASE_URL") ?: "jdbc:postgresql://localhost:5432/primeledger"
    user = System.getenv("DATABASE_USER") ?: "primeledger"
    password = System.getenv("DATABASE_PASSWORD") ?: "primeledger"
    locations = arrayOf("filesystem:src/main/resources/db/migration")
    cleanDisabled = true
}
