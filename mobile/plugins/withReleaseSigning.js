const { withAppBuildGradle, createRunOncePlugin } = require('expo/config-plugins');

const SIGNING_CONFIG_RELEASE_BLOCK = `
        release {
            def keystorePropsFile = rootProject.file("keystore.properties")
            if (!keystorePropsFile.exists()) {
                keystorePropsFile = file("keystore.properties")
            }
            if (!keystorePropsFile.exists()) {
                keystorePropsFile = rootProject.file("../keystore.properties")
            }
            def keystoreProps = new Properties()
            if (keystorePropsFile.exists()) {
                keystoreProps.load(new FileInputStream(keystorePropsFile))
            }

            def envStoreFile = System.getenv("RELEASE_STORE_FILE") ?: System.getenv("ANDROID_KEYSTORE_FILE") ?: keystoreProps['storeFile']
            def envStorePassword = System.getenv("RELEASE_STORE_PASSWORD") ?: System.getenv("ANDROID_KEYSTORE_PASSWORD") ?: keystoreProps['storePassword']
            def envKeyAlias = System.getenv("RELEASE_KEY_ALIAS") ?: System.getenv("ANDROID_KEY_ALIAS") ?: keystoreProps['keyAlias']
            def envKeyPassword = System.getenv("RELEASE_KEY_PASSWORD") ?: System.getenv("ANDROID_KEY_PASSWORD") ?: keystoreProps['keyPassword']

            if (envStoreFile && envStorePassword && envKeyAlias && envKeyPassword) {
                def resolvedStoreFile = rootProject.file(envStoreFile)
                if (!resolvedStoreFile.exists() && file(envStoreFile).exists()) {
                    resolvedStoreFile = file(envStoreFile)
                }
                if (!resolvedStoreFile.exists() && rootProject.file("../" + envStoreFile).exists()) {
                    resolvedStoreFile = rootProject.file("../" + envStoreFile)
                }
                if (!resolvedStoreFile.exists() && file(envStoreFile).isAbsolute()) {
                    resolvedStoreFile = file(envStoreFile)
                }
                storeFile resolvedStoreFile
                storePassword envStorePassword
                keyAlias envKeyAlias
                keyPassword envKeyPassword
            }
        }`;

const SIGNING_VALIDATION_BLOCK = `
// Loud failure enforcement for release builds with missing signing credentials
gradle.taskGraph.whenReady { taskGraph ->
    def isReleaseBuild = taskGraph.allTasks.any { task ->
        task.name.toLowerCase().contains("release") && (task.name.toLowerCase().contains("assemble") || task.name.toLowerCase().contains("bundle"))
    }
    if (isReleaseBuild) {
        def releaseSigning = android.signingConfigs.findByName("release")
        if (releaseSigning == null || releaseSigning.storeFile == null || !releaseSigning.storeFile.exists() || releaseSigning.storePassword == null || releaseSigning.keyAlias == null || releaseSigning.keyPassword == null) {
            throw new GradleException(
                "\\n========================================================================\\n" +
                "RELEASE BUILD FAILED: Release signing credentials are missing or invalid!\\n" +
                "Expected either:\\n" +
                "  1. mobile/android/keystore.properties (or mobile/keystore.properties)\\n" +
                "     with storeFile, storePassword, keyAlias, keyPassword\\n" +
                "  2. Environment variables: RELEASE_STORE_FILE, RELEASE_STORE_PASSWORD,\\n" +
                "     RELEASE_KEY_ALIAS, RELEASE_KEY_PASSWORD (or ANDROID_KEYSTORE_*)\\n" +
                "Release builds NEVER fall back to debug signing.\\n" +
                "========================================================================\\n"
            )
        }
    }
}
`;

function modifyAppBuildGradle(contents) {
  let newContents = contents;

  // 1. Remove existing release signing block if already customized
  const existingReleaseRegex = /release\s*\{[\s\S]*?def\s+keystorePropsFile[\s\S]*?\n\s*\}/g;
  if (existingReleaseRegex.test(newContents)) {
    newContents = newContents.replace(existingReleaseRegex, '');
  }

  // 2. Inject release signing block into signingConfigs
  if (newContents.includes('signingConfigs {') && !newContents.includes('def keystorePropsFile')) {
    const debugBlockMatch = newContents.match(/signingConfigs\s*\{[\s\S]*?debug\s*\{[\s\S]*?\}\s*\}/);
    if (debugBlockMatch) {
      newContents = newContents.replace(
        debugBlockMatch[0],
        debugBlockMatch[0].replace(/\}\s*$/, `${SIGNING_CONFIG_RELEASE_BLOCK}\n    }`)
      );
    }
  }

  // 3. Ensure buildTypes.release has signingConfig signingConfigs.release
  const buildTypesIndex = newContents.indexOf('buildTypes {');
  if (buildTypesIndex !== -1) {
    const afterBuildTypes = newContents.slice(buildTypesIndex);
    const releaseMatch = afterBuildTypes.search(/\brelease\s*\{/);
    if (releaseMatch !== -1) {
      const fullReleaseIndex = buildTypesIndex + releaseMatch;
      const releaseContent = newContents.slice(fullReleaseIndex);
      const releaseClose = releaseContent.indexOf('}');
      if (releaseClose !== -1) {
        let releaseChunk = releaseContent.slice(0, releaseClose);
        if (releaseChunk.includes('signingConfig signingConfigs.debug')) {
          releaseChunk = releaseChunk.replace(
            'signingConfig signingConfigs.debug',
            'signingConfig signingConfigs.release'
          );
          newContents = newContents.slice(0, fullReleaseIndex) + releaseChunk + newContents.slice(fullReleaseIndex + releaseClose);
        } else if (!releaseChunk.includes('signingConfig signingConfigs.release')) {
          releaseChunk = releaseChunk.replace(
            /release\s*\{/,
            'release {\n            signingConfig signingConfigs.release'
          );
          newContents = newContents.slice(0, fullReleaseIndex) + releaseChunk + newContents.slice(fullReleaseIndex + releaseClose);
        }
      }
    }
  }

  // 4. Inject loud validation block at end of file if not present
  if (!newContents.includes('RELEASE BUILD FAILED: Release signing credentials')) {
    newContents = newContents.trimEnd() + '\n' + SIGNING_VALIDATION_BLOCK;
  }

  return newContents;
}

const withReleaseSigning = (config) => {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      config.modResults.contents = modifyAppBuildGradle(config.modResults.contents);
    } else {
      throw new Error('Cannot configure release signing because app/build.gradle is not Groovy');
    }
    return config;
  });
};

module.exports = createRunOncePlugin(withReleaseSigning, 'withReleaseSigning', '1.0.0');
