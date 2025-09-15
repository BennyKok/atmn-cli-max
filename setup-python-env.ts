#!/usr/bin/env bun

import { $ } from "bun";
import { existsSync } from "fs";
import { resolve, join } from "path";

async function findPythonLibrary() {
  const isWin = process.platform === "win32";
  const isMac = process.platform === "darwin";
  const venvPath = resolve(".venv");
  const pythonExe = isWin ? join(venvPath, "Scripts", "python.exe") : join(venvPath, "bin", "python");
  
  try {
    // Check if venv exists
    if (!existsSync(pythonExe)) {
      console.error("Virtual environment not found at:", venvPath);
      console.error("Please make sure your .venv directory exists and contains a Python installation.");
      process.exit(1);
    }

    // Get Python version and library paths from venv
    const versionResult = await $`${pythonExe} -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"`.quiet();
    const pythonVersion = versionResult.stdout.toString().trim();
    
    console.log(`Found Python ${pythonVersion} in virtual environment`);
    
    // Get site-packages path
    const sitePackagesResult = await $`${pythonExe} -c "import sysconfig; print(sysconfig.get_paths()['purelib'])"`.quiet();
    const sitePackages = sitePackagesResult.stdout.toString().trim();

    let pythonLibPath: string | null = null;

    if (isMac) {
      // Try to find the Python library that the venv is using
      const possiblePaths = [
        // Homebrew Python (current version)
        `/opt/homebrew/lib/libpython${pythonVersion}.dylib`,
        // System Python
        `/Library/Frameworks/Python.framework/Versions/${pythonVersion}/lib/libpython${pythonVersion}.dylib`,
      ];

      // Check static paths first
      for (const libPath of possiblePaths) {
        if (existsSync(libPath)) {
          pythonLibPath = libPath;
          break;
        }
      }

      // If not found, try Homebrew cellar with glob patterns
      if (!pythonLibPath) {
        try {
          const homebrewResult = await $`find /opt/homebrew/Cellar/python@${pythonVersion} -name "libpython${pythonVersion}.dylib" 2>/dev/null || true`.quiet();
          const matches = homebrewResult.stdout.toString().trim().split('\n').filter(Boolean);
          if (matches.length > 0) {
            pythonLibPath = matches[0];
          }
        } catch (e) {
          // Continue
        }
      }

      // Try uv Python installations
      if (!pythonLibPath) {
        try {
          const uvResult = await $`find ${process.env.HOME}/.local/share/uv/python -name "libpython${pythonVersion}.dylib" 2>/dev/null || true`.quiet();
          const matches = uvResult.stdout.toString().trim().split('\n').filter(Boolean);
          if (matches.length > 0) {
            pythonLibPath = matches[0];
          }
        } catch (e) {
          // Continue
        }
      }
    } else if (isWin) {
      // Windows Python library detection
      const possiblePaths = [
        join(venvPath, "Scripts", `python${pythonVersion.replace('.', '')}.dll`),
        `C:/Python${pythonVersion.replace('.', '')}/python${pythonVersion.replace('.', '')}.dll`
      ];
      
      for (const libPath of possiblePaths) {
        if (existsSync(libPath)) {
          pythonLibPath = libPath;
          break;
        }
      }
    } else {
      // Linux Python library detection
      const possiblePaths = [
        `/usr/lib/libpython${pythonVersion}.so`,
        `/usr/lib/x86_64-linux-gnu/libpython${pythonVersion}.so`,
        `/usr/local/lib/libpython${pythonVersion}.so`
      ];
      
      for (const libPath of possiblePaths) {
        if (existsSync(libPath)) {
          pythonLibPath = libPath;
          break;
        }
      }
    }

    if (!pythonLibPath) {
      console.error(`Could not find Python ${pythonVersion} dynamic library.`);
      console.error('You may need to set BUN_PYTHON_PATH manually.');
      console.error('Searched locations:');
      if (isMac) {
        console.error('- /opt/homebrew/lib/');
        console.error('- /opt/homebrew/Cellar/python@*/');
        console.error('- ~/.local/share/uv/python/');
        console.error('- /Library/Frameworks/Python.framework/');
      }
      process.exit(1);
    }

    return {
      pythonLibPath,
      sitePackages,
      pythonVersion
    };

  } catch (error) {
    console.error("Error detecting Python configuration:", error);
    process.exit(1);
  }
}

async function main() {
  const { pythonLibPath, sitePackages, pythonVersion } = await findPythonLibrary();
  
  console.log(`Using Python ${pythonVersion} library: ${pythonLibPath}`);
  console.log(`Using site-packages: ${sitePackages}`);
  
  // Get command line arguments (everything after "bun setup-python-env.ts")
  const bunArgs = process.argv.slice(2);
  
  if (bunArgs.length === 0) {
    console.error("Usage: bun setup-python-env.ts <bun-arguments>");
    console.error("Example: bun setup-python-env.ts cd/cd-modal.tsx");
    process.exit(1);
  }

  // Set environment variables and spawn bun
  console.log(`Running: bun ${bunArgs.join(" ")}`);
  
  const env = {
    ...process.env,
    BUN_PYTHON_PATH: pythonLibPath,
    PYTHONPATH: sitePackages
  };

  // Use Bun's spawn to run the command with the environment
  const proc = Bun.spawn(["bun", ...bunArgs], {
    env,
    stdio: ["inherit", "inherit", "inherit"]
  });

  const exitCode = await proc.exited;
  process.exit(exitCode);
}

main().catch(console.error);
