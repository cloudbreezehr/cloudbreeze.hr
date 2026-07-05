// ── Terminal Commands ──
// The command catalogue behind the sky shell: pure functions from a parsed
// argv to printable lines, with every side effect routed through injected
// deps. Nothing here touches the DOM or the window — the overlay owns
// presentation; this module owns behaviour, so it tests without a browser.
//
// A command's `run(argv, ctx)` returns { lines, clear?, close? }: text to
// print, whether to wipe the scrollback, whether to close the overlay.

// ── Ping theatre ──
const PING_ECHOES = 4;
const PING_TTL = "∞";
const PING_MS_MIN = 0.2;
const PING_MS_RANGE = 0.6;
const PING_MS_DECIMALS = 1;

// ── Top theatre ──
const TOP_CPU_MIN = 0.3;
const TOP_CPU_RANGE = 4.2;
const TOP_CPU_DECIMALS = 1;

const DEFAULT_HOST = "cloudbreeze.hr";
const PROMPT_USER = "visitor";

function pad(text, width) {
  return String(text).padEnd(width);
}

// `sudo rm -rf /` in any flag spelling (-rf, -fr, split flags) aimed at the
// filesystem root.
// The classic `rm -rf /` in any flag arrangement. `rmArgs` is the tokens that
// follow `rm` — so `["-rf","/"]`, `["-r","-f","/"]`, or with extra flags like
// `["-rf","--no-preserve-root","/"]` all qualify.
function isRmRfRoot(rmArgs) {
  const flags = rmArgs.filter((a) => a.startsWith("-")).join("");
  const targets = rmArgs.filter((a) => !a.startsWith("-"));
  return flags.includes("r") && flags.includes("f") && targets.includes("/");
}

export function createCommands(deps) {
  const {
    themes, // { list: () => [{ id, label, active }], activate(id), deactivate(id), clearAll: () => string[] }
    spellWords, // () => [{ word, hint }]
    castWord, // (word) => boolean — casts a spell; false when unknown
    stats, // () => { points, unlocked, total }
    qualityTier, // () => string
    openCheatsheet, // () => void
    daily, // () => { seedKey, todayKey, traveling, word, link }
    passport, // { issue: () => code, stamp: (code) => { added, total } | null }
    copy, // (text) => void — best-effort clipboard write
    emit, // (type, data?) => void — achievement event stream
  } = deps;

  // The `rm -rf /` payoff, reachable bare or behind `sudo` — clears the active
  // themes and prints the doomed-but-not-quite transcript.
  function scorchedEarth() {
    emit("terminal-rm-rf");
    const removed = themes.clearAll();
    const lines = removed.map((id) => `removed '/sky/themes/${id}'`);
    if (removed.length === 0) {
      lines.push("rm: nothing to remove — the sky is already clear");
    }
    lines.push("rm: cannot remove '/sky': Operation not permitted");
    lines.push("(some things survive even root)");
    return { lines };
  }

  const commands = [
    {
      name: "help",
      summary: "list the available commands",
      run() {
        const width = Math.max(...commands.map((c) => c.name.length)) + 2;
        return {
          lines: [
            "The sky shell. Commands:",
            ...commands.map((c) => `  ${pad(c.name, width)}${c.summary}`),
            "",
            "Anything else you'd try in a real shell is worth trying here.",
          ],
        };
      },
    },
    {
      name: "whoami",
      summary: "who you are, and how deep you've gone",
      run() {
        const { points, unlocked, total } = stats();
        return {
          lines: [
            `${PROMPT_USER}@${DEFAULT_HOST} — ${unlocked}/${total} secrets · ${points} points`,
          ],
        };
      },
    },
    {
      name: "ls",
      summary: "look around",
      run(argv) {
        const dir = (argv[0] || "").replace(/\/$/, "");
        if (dir === "" || dir === ".") {
          return { lines: ["themes/  spells/  achievements/  secrets/"] };
        }
        if (dir === "themes") {
          return {
            lines: [
              themes
                .list()
                .map((t) => t.id)
                .join("  "),
            ],
          };
        }
        if (dir === "spells") {
          return {
            lines: [
              spellWords()
                .map((s) => s.word.toLowerCase())
                .join("  "),
            ],
          };
        }
        if (dir === "achievements") {
          const { unlocked, total } = stats();
          return {
            lines: [`${unlocked} unlocked, ${total - unlocked} still hidden.`],
          };
        }
        if (dir === "secrets") {
          return {
            lines: [
              "ls: cannot open directory 'secrets/': Permission denied",
              "(they wouldn't be secrets otherwise)",
            ],
          };
        }
        return { lines: [`ls: cannot access '${argv[0]}': No such directory`] };
      },
    },
    {
      name: "man",
      summary: "open the book of secrets",
      run() {
        openCheatsheet();
        return { lines: ["Opening the book of secrets…"] };
      },
    },
    {
      name: "ping",
      summary: "check the cloud is up",
      run(argv) {
        const host = argv[0] || DEFAULT_HOST;
        const lines = [`PING ${host} (the cloud): 56 data bytes`];
        for (let i = 0; i < PING_ECHOES; i++) {
          const ms = (PING_MS_MIN + Math.random() * PING_MS_RANGE).toFixed(
            PING_MS_DECIMALS,
          );
          lines.push(
            `64 bytes from ${host}: icmp_seq=${i} ttl=${PING_TTL} time=${ms} ms`,
          );
        }
        lines.push(
          `--- ${host} ping statistics ---`,
          `${PING_ECHOES} packets transmitted, ${PING_ECHOES} received, 0.0% packet loss`,
          "(the cloud never drops you)",
        );
        return { lines };
      },
    },
    {
      name: "ssh",
      summary: "try to reach the sky directly",
      run(argv) {
        const target = argv[0] || `sky@${DEFAULT_HOST}`;
        return {
          lines: [
            `ssh: connect to host ${target} port 22:`,
            "Permission denied (publickey,stardust).",
          ],
        };
      },
    },
    {
      name: "rm",
      summary: "remove files (mind the root)",
      run(argv) {
        if (isRmRfRoot(argv)) return scorchedEarth();
        return {
          lines: [
            "rm: missing operand (and courage)",
            "the truly reckless know the full incantation",
          ],
        };
      },
    },
    {
      name: "sudo",
      summary: "ask for more power",
      run(argv) {
        if (argv[0] === "rm" && isRmRfRoot(argv.slice(1))) {
          return scorchedEarth();
        }
        emit("terminal-sudo-denied");
        return {
          lines: [
            `${PROMPT_USER} is not in the sudoers file.`,
            "This incident will be reported.",
          ],
        };
      },
    },
    {
      name: "kubectl",
      summary: "orchestrate the skies",
      run(argv) {
        const [verb, kind, ...rest] = argv;
        const known = themes.list();
        if (verb === "get" && (kind === "themes" || kind === "pods")) {
          emit("terminal-kubectl");
          const width =
            Math.max(...known.map((t) => t.id.length), "NAME".length) + 3;
          return {
            lines: [
              `${pad("NAME", width)}READY   STATUS`,
              ...known.map(
                (t) =>
                  `${pad(t.id, width)}${t.active ? "1/1" : "0/1"}     ${
                    t.active ? "Running" : "Dormant"
                  }`,
              ),
            ],
          };
        }
        if (verb === "apply") {
          // `kubectl apply -f <theme>` — the -f is tradition, not required.
          const id = rest.filter((a) => !a.startsWith("-")).pop() || kind;
          const target = known.find((t) => t.id === id);
          if (!target) {
            return { lines: [`error: theme "${id ?? ""}" not found`] };
          }
          emit("terminal-kubectl");
          if (target.active) {
            return { lines: [`theme.cloudbreeze.hr/${id} unchanged`] };
          }
          themes.activate(id);
          return { lines: [`theme.cloudbreeze.hr/${id} configured`] };
        }
        if (verb === "delete" && (kind === "theme" || kind === "pod")) {
          const id = rest[0];
          const target = known.find((t) => t.id === id);
          if (!target) {
            return { lines: [`Error from server (NotFound): "${id ?? ""}"`] };
          }
          emit("terminal-kubectl");
          if (!target.active) {
            return { lines: [`theme "${id}" already dormant`] };
          }
          themes.deactivate(id);
          return { lines: [`theme "${id}" deleted`] };
        }
        return {
          lines: ['error: unknown command — try "kubectl get themes"'],
        };
      },
    },
    {
      name: "cast",
      summary: "cast a spell by name",
      run(argv) {
        const word = (argv[0] || "").toUpperCase();
        if (!word) {
          return { lines: ["cast: which spell? (see `ls spells`)"] };
        }
        if (!castWord(word)) {
          return {
            lines: [
              `cast: unknown spell '${word}' — the book of secrets may help (man)`,
            ],
          };
        }
        return { lines: [`${word} released.`] };
      },
    },
    {
      name: "deploy",
      summary: "ship it",
      run() {
        castWord("DEPLOY");
        return { lines: ["Deploying to production… done.", "Ship it. 🚀"] };
      },
    },
    {
      name: "passport",
      summary: "carry your progress to another device",
      run(argv) {
        if (argv[0]) {
          const result = passport.stamp(argv[0]);
          if (!result) {
            return {
              lines: [
                "passport: that code didn't validate — paste the whole thing",
              ],
            };
          }
          emit("passport-import");
          return {
            lines: [
              `Stamped. ${result.added} new unlock${
                result.added === 1 ? "" : "s"
              } carried over (${result.total} on the passport).`,
              "Reload the page to let the sky catch up.",
            ],
          };
        }
        const code = passport.issue();
        copy(code);
        emit("passport-export");
        return {
          lines: [
            "Your passport (copied to clipboard):",
            code,
            "On the other device: open the terminal, `passport <code>`.",
          ],
        };
      },
    },
    {
      name: "today",
      summary: "the sky of the day and its word",
      run() {
        const d = daily();
        const lines = [];
        if (d.traveling) {
          lines.push(
            `You're standing under a past sky: ${d.seedKey}`,
            `Today's is ${d.todayKey} — drop the #sky link to come home.`,
          );
        } else {
          lines.push(
            `Sky of the day: ${d.seedKey}`,
            "Every visitor shares this arrangement; at midnight it's gone.",
            `Keep it: ${d.link}`,
          );
        }
        lines.push(
          `Word of the day: ${d.word} — cast it while it's in season.`,
        );
        return { lines };
      },
    },
    {
      name: "top",
      summary: "what the sky is running",
      run() {
        const running = themes.list().filter((t) => t.active);
        const width =
          Math.max(...themes.list().map((t) => t.id.length), "sky".length) + 3;
        const row = (name) =>
          `${pad(name, width)}${(
            TOP_CPU_MIN +
            Math.random() * TOP_CPU_RANGE
          ).toFixed(TOP_CPU_DECIMALS)}%`;
        return {
          lines: [
            `quality tier: ${qualityTier()} · ${running.length} theme${
              running.length === 1 ? "" : "s"
            } running · load average: breeze`,
            `${pad("NAME", width)}CPU`,
            row("sky"),
            ...running.map((t) => row(t.id)),
          ],
        };
      },
    },
    {
      name: "uname",
      summary: "kernel details",
      run() {
        return { lines: ["CloudbreezeOS 5.0 sky-kernel #1 SMP cloud/∞"] };
      },
    },
    {
      name: "echo",
      summary: "say it back",
      run(argv) {
        return { lines: [argv.join(" ")] };
      },
    },
    {
      name: "history",
      summary: "what you've typed",
      run(argv, ctx) {
        return {
          lines: ctx.history.map((line, i) => `  ${i + 1}  ${line}`),
        };
      },
    },
    {
      name: "clear",
      summary: "wipe the scrollback",
      run() {
        return { lines: [], clear: true };
      },
    },
    {
      name: "exit",
      summary: "close the terminal",
      run() {
        return { lines: ["logout"], close: true };
      },
    },
  ];

  return commands;
}

/**
 * Parse and execute one input line against the catalogue. Unknown commands
 * get the classic scolding. `ctx.history` is the caller's command history
 * (already including this line).
 */
export function executeLine(line, commands, ctx) {
  const argv = line.trim().split(/\s+/).filter(Boolean);
  if (argv.length === 0) return { lines: [] };
  const [name, ...args] = argv;
  const command = commands.find((c) => c.name === name.toLowerCase());
  if (!command) {
    return { lines: [`sky: command not found: ${name}`] };
  }
  return command.run(args, ctx);
}
