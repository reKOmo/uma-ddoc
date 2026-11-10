// PreToolUse hook (Bash): blocks shell commands that would show UmaTL's data to the agent. UmaTL's terms forbid any use
// with generative models (docs/data/umatl.md). `pnpm fetch-umatl` (prints counts only) and `pnpm dev:ai` (fan
// translations masked) don't name the files, so they pass.
let input = '';
for await (const chunk of process.stdin) input += chunk;
const command = JSON.parse(input || '{}').tool_input?.command ?? '';
const UMATL =
  /translations\.json|umatl_(text_data|mdb)|raw\.githubusercontent\.com\/(UmaTL|noccu)\/|repos\/(UmaTL\/hachimi-tl-en|noccu\/umamusu-translate)\/contents/;
if (UMATL.test(command))
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          "UmaTL's data is off-limits to AI agents (its terms forbid use with generative models). Run `pnpm fetch-umatl` (counts only), and `pnpm dev:ai` for screenshots (fan translations masked). See docs/data/umatl.md.",
      },
    })
  );
