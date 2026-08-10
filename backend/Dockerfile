# Railway deploys this image directly (proposal §5.1, §13.1).
#
# Two stages: the JDK and the Gradle cache stay in the builder, and the shipped
# image carries a JRE and one jar.

FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /build

# Dependencies resolve in their own layer, so editing a source file does not
# re-download the world.
COPY gradlew settings.gradle.kts build.gradle.kts gradle.properties ./
COPY gradle gradle
RUN chmod +x gradlew && ./gradlew --no-daemon dependencies --quiet || true

COPY src src
RUN ./gradlew --no-daemon bootJar -x test

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Never root. A container escape should not start with a privileged process.
RUN addgroup -S primeledger && adduser -S primeledger -G primeledger
USER primeledger

COPY --from=build --chown=primeledger:primeledger /build/build/libs/*.jar app.jar

EXPOSE 8080
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0"

# Railway's health gate and the deploy workflow both wait on this (§13.2).
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD wget -qO- http://localhost:8080/actuator/health/readiness || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
