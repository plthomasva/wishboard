# Analysis: Unifying Cross-Platform Deployment Scripts

You asked if there is a standard, open-source mechanism to maintain the logical semantics of your deployment/setup processes in one place and *instantiate* (compile/transpile) platform-specific `.sh` and `.ps1` variants as build artifacts.

## The Short Answer

**There is no widely adopted, production-ready open-source tool that transpiles a single configuration or DSL directly into both idiomatic Bash and PowerShell scripts.** 

Because Bash is fundamentally string/stream-oriented and PowerShell is object-oriented, attempting to generate both from a single AST (Abstract Syntax Tree) usually produces brittle, unreadable, and unmaintainable code. 

However, the industry solves this "cross-platform operational duplication" problem using other proven patterns. Below is an analysis of the alternatives, their pros/cons, and a final recommendation tailored to the Wishboard tech stack.

---

## Alternative 1: Write a CLI in a Cross-Platform Language (Compiled to Binary)
Instead of generating `.sh` and `.ps1` scripts, you write a single CLI application (e.g., in **Go** or **Rust**) that executes your deployment logic. You then compile this CLI into standalone binaries (`wishboard-cli-linux-arm64`, `wishboard-cli-windows-amd64.exe`) and distribute those as your build artifacts.

* **Pros:**
  * **True Single Source of Truth:** You write the logic once using standard OS abstractions.
  * **Zero Runtime Dependencies:** Compiled binaries don't require Node, Python, or PowerShell to be installed on the target machine.
  * **Highly Testable:** You can write unit tests for your deployment logic.
* **Cons:**
  * Requires introducing a new language (Go/Rust) to a TypeScript-heavy codebase.
  * System calls (like interacting with `systemctl` or Windows Registry) still require OS-specific conditional branching inside the code (e.g., `if runtime.GOOS == "windows"`).

## Alternative 2: TypeScript / Node.js Scripts (with Bootstrap)
Since Wishboard is a full-stack TypeScript project, you can write your operational scripts in TypeScript using tools like [Google `zx`](https://github.com/google/zx) or native Node.js, and compile them to a single `.js` file via `esbuild`. 
For bare-metal targets that don't have Node.js installed yet (like the Raspberry Pi kiosk), you maintain a tiny 5-line "bootstrap" `.sh` or `.ps1` script that installs Node, downloads the JS artifact, and executes it.

* **Pros:**
  * Leverages your team's existing TypeScript expertise.
  * Extremely powerful standard library for network, file system, and API calls.
  * Can be bundled into a Single Executable Application (SEA) using modern Node.js features or `pkg` if you want to avoid the bootstrap script entirely.
* **Cons:**
  * Node.js can feel heavy for simple file-moving or systemd setup tasks.
  * Interacting with native OS concepts (like PowerShell modules or Linux `apt`) still requires spawning child processes that are OS-specific.

## Alternative 3: Configuration Management (Ansible)
Tools like **Ansible** use declarative YAML (playbooks) to maintain logical semantics (e.g., "ensure the wishboard user exists"). Ansible abstracts the underlying OS, translating your YAML into Python (Linux) or PowerShell (Windows) under the hood.

* **Pros:**
  * Exactly matches the desire to "maintain logical semantics in one place".
  * Idempotent by design (safe to run multiple times).
* **Cons:**
  * Does not produce standalone `.sh` or `.ps1` scripts as build artifacts.
  * Requires a "control node" with Python installed to execute the playbooks against the targets over SSH or WinRM. This might not fit a "download and run locally" model for casual users.

## Alternative 4: Cross-Platform Task Runners (Taskfile, Just)
Using a tool like `go-task` or `just`, you define your workflows in a single YAML or Makefile-like format.

* **Pros:**
  * Unified developer experience (e.g., everyone runs `task deploy`).
* **Cons:**
  * They do not generate standalone scripts.
  * They do not abstract OS differences; inside the `Taskfile.yml`, you still have to write `cmd: powershell ...` for Windows and `cmd: bash ...` for Linux. The duplication just moves into the YAML file.

---

## Conclusion & Recommendation

**Recommendation: Do not try to transpile to `.sh` and `.ps1`. Instead, migrate complex logic to a Node.js/TypeScript CLI, bundled as a standalone executable or run via a micro-bootstrap script.**

Given that Wishboard is heavily invested in TypeScript (React, Node, Express) and Vite, I recommend:

1. **Move complex deployment logic into a `scripts/cli` TypeScript package.** Use libraries like `execa` or Google `zx`. 
2. **Handle OS branching internally.** Instead of two files, you have one function `setupNetwork()` that checks `os.platform()` and executes `nmcli` on Linux or `netsh` on Windows.
3. **Distribution:** You can compile this CLI into standalone executables using tools like [Node.js SEA (Single Executable Applications)](https://nodejs.org/api/single-executable-applications.html) or `pkg`. This gives you a `wishboard-setup-linux` and `wishboard-setup-win.exe` artifact that requires zero external dependencies, exactly like a bash or powershell script.

### Pros/Cons of this refactor for Wishboard:
* **Pros:** You drastically reduce duplication, gain type safety for your deployment logic, enable unit testing for infrastructure steps, and allow your developers to write infrastructure code in the language they already know (TS).
* **Cons:** There is an upfront cost to porting the existing ~1000 lines of Bash/PowerShell into TypeScript, and you have to set up the build step to compile the CLI into standalone executables. 

If this approach sounds appealing, we can start by porting one of the smaller duplicated script pairs (like `destroy-oidc` or `setup-oidc`) into a unified Node CLI to validate the pattern!
