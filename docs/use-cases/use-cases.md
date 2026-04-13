# Use Cases

## Why Porygon-Z Exists

I'm Irving Dinh, a software engineer at SAP. Outside of work, I'm a passionate builder — I maintain a swarm of side projects, hobby experiments, and personal infrastructure that lives across multiple machines running different operating systems.

Every one of those machines is powered by Claude Code. The problem is: I can only use Claude Code when I'm sitting at the machine. The moment I walk away — to grab coffee, take a break at work, go for a walk — I lose access to all of it.

I needed a way to keep working from anywhere, with nothing more than my phone. Porygon-Z is the tool I built to solve that.

Named after a Pokémon known for being complicated and unstable — just like my workspaces — Porygon-Z turns Slack into a remote control for Claude Code running on your own machines.

## The Core Thesis

**Full Claude Code power, on your machines, from your phone, via Slack.**

Porygon-Z is not a chatbot. It's not a coding assistant. It's an interface layer that gives you remote access to the complete Claude Code CLI — every tool, every capability, every model — running on your own hardware, accessible from any device with Slack installed.

## Two Pillars

### 1. Remote Access — Work From Anywhere

The primary use case is simple: I walk away from my machine, but my work doesn't stop.

- I'm on a break at SAP and want to check on a side project building at home
- I'm walking outside and an idea hits — I fire off a task to Claude Code on my home server
- Five minutes before a talk, I need a quick fix on my slides — I message my bot and it's done by the time I'm at the podium
- I'm in bed, scrolling my phone, and I remember a bug — I describe it in Slack and check the fix in the morning

The interaction patterns are unlimited:

- **Fire-and-forget**: "Implement this feature based on the spec" — check back in 10 minutes
- **Interactive steering**: Multiple messages in a thread, guiding Claude's work step by step
- **Quick check-ins**: "What's the current state of the build?"
- **Long-running automation**: "Continuously implement, test, and iterate on this feature"
- **Autonomous creative work**: Wire in MCP tools and let Claude create content entirely on its own
- **Scheduled workflows**: Set up recurring Slack messages to fully automate your development pipeline

The philosophy is simple: don't limit AI tools. Porygon-Z is as capable as Claude Code itself — the only difference is the interface.

### 2. Multi-Tenant Architecture — Every Machine, Every Project, Isolated

Each of my machines runs its own Porygon-Z instance as a dedicated Slack app. Each project gets its own Slack channel with independent configuration.

My current setup:

| Slack App | Machine | Purpose |
|-----------|---------|---------|
| Porygon-Z | Daily driver (macOS) | Development, Obsidian knowledge base |
| Snorlax | Home server (Ubuntu) | Heavy compute, production workloads |
| Porygon-Z (Testing) | Test instance | Development and QA |

Each channel maps to a project or workspace:

- `porygon-z-obsidian` — Query my personal knowledge base remotely
- `porygon-z-porygon-z` — Develop Porygon-Z itself on my daily machine
- `snorlax-porygon-z` — Develop Porygon-Z on my home server
- `porygon-z-playground` — Test prompts and experiments

The naming convention `<machine>-<project>` turns the Slack sidebar into a dashboard of my entire infrastructure.

Every channel has its own configuration: working directory, Claude model, effort level, permission mode, and custom instructions. One channel might run Opus at max effort with full permissions for trusted development. Another might run Haiku at low effort for quick lookups. The configuration lives at the machine level, scoped per workspace — so each project gets the exact environment it needs.

## Beyond Code

Despite the name "Claude Code," Porygon-Z isn't limited to coding. It's a remote AI agent that has access to everything on your machine. Because it runs locally, it can reach things cloud-hosted alternatives never could:

- **Knowledge retrieval**: My Obsidian vault lives on my machine. Through Porygon-Z, I can query my personal knowledge base from anywhere — "What were my notes on that architecture decision last month?"
- **Creative work**: Wire in MCP tools and let Claude generate content autonomously — videos, images, documents
- **System administration**: Manage services, check logs, monitor processes on your home server
- **File operations**: Access, transform, and share files from your local machine without uploading them to the cloud first
- **Scheduled automation**: Set up recurring tasks that run on your infrastructure, on your schedule

The use cases are as limitless as Claude Code itself. Porygon-Z just removes the constraint that you need to be physically present.

## Why Not the Alternatives?

### Claude Code Remote

Claude Code Remote gives you a managed cloud VM with Claude Code pre-installed. It works — but the VM is not your machine. It doesn't have your file system, your credentials, your Obsidian vault, your production database, your MCP tools, or your local network access. For someone whose projects live on physical machines at home, a cloud VM is a sandbox disconnected from reality.

### Claude Code Channel

Claude Code Channel is Anthropic's native Slack integration. It's a managed service — you can't control where it runs, what it has access to, or how it behaves per channel. There's no per-workspace configuration, no multi-machine topology, no access to your local infrastructure. It's a single bot with a single configuration, running on Anthropic's servers.

### OpenClaw

OpenClaw is the closest open-source alternative — also a Slack-to-Claude bridge. Three things set Porygon-Z apart:

1. **Simplicity over extensibility.** OpenClaw is built for generic use and designed to be extended infinitely. That flexibility comes with complexity that's hard to control. Porygon-Z is opinionated and focused — it does exactly what I need, nothing more.

2. **Policy compliance.** OpenClaw uses a workaround to leverage Claude with Claude Code tokens in a way that goes against Anthropic's usage policy. Porygon-Z uses the Claude Code CLI directly, as intended. This isn't just about ethics — a policy-violating tool carries existential risk of being shut down at any time.

3. **Builder's philosophy.** I'm a software engineer. Building Porygon-Z is part of the value — I learn Claude Code internals, Slack APIs, and AI agent orchestration patterns firsthand. The tool is both the product and the education.

## Security: Zero Inbound Ports

Porygon-Z uses Slack's Socket Mode — the bot initiates an outbound WebSocket connection to Slack. No inbound ports are opened. No public endpoints are exposed. No tunnels, VPNs, or reverse proxies are needed.

Your machine sits behind NAT and firewall, completely invisible to the internet, yet fully accessible through Slack.

This isn't just a convenience — it's a meaningful security property:

| Access Method | Inbound Port Required | Blocked by Corporate IT |
|--------------|----------------------|------------------------|
| SSH | Yes (port 22) | Often |
| Tailscale / VPN | Yes (overlay network) | Often |
| Webhook-based bots | Yes (public endpoint) | Sometimes |
| Self-hosted web UIs | Yes (port forwarding) | Often |
| **Porygon-Z (Socket Mode)** | **No** | **No — Slack is already approved** |

This last row is the key insight. I used to run tools behind Tailscale, but Tailscale is blocked on my SAP company machine. Slack, on the other hand, is an approved business communication tool installed on every device — personal phones, work laptops, tablets. Porygon-Z turns that ubiquity into infrastructure.

No IT exceptions. No policy violations. No exposed attack surface. Just Slack.

## Technical Foundation

### CLI-as-Substrate

Porygon-Z wraps the Claude Code CLI — it spawns `claude` as a child process with streaming JSON output. This is a deliberate architectural bet:

- **Zero-cost feature inheritance**: When Anthropic ships a new CLI capability, Porygon-Z gets it for free
- **Full tool access**: Bash, file I/O, web search, MCP tools — everything the CLI supports
- **Session resumption**: Claude Code's native `--resume` flag enables multi-turn conversations across Slack threads
- **Subscription economics**: Uses the Claude Code subscription, not per-token API pricing

This means Porygon-Z will never be more capable than the CLI — but it will always be exactly as capable. The tool exists only as an interface layer, not a reimplementation.

### Slack as the Control Plane

Slack provides the interface, authentication, and delivery mechanism:

- **Threading** maps naturally to Claude Code sessions — one thread, one conversation
- **Channels** map to workspaces — one channel, one project configuration
- **Reactions** signal execution state — visible in phone notifications without opening the app
- **File sharing** enables seamless I/O — attach files for Claude to process, receive generated files back
- **Text commands** provide instant operational control — `!kill`, `!cd`, `!workspace`, `!sessions`

### Real-Time Streaming

While Claude works, Porygon-Z streams progress updates to the Slack thread every two seconds. You can see what Claude is thinking, which tools it's using, and how far along it is — all from your phone. When it's done, the final result replaces the progress message cleanly.

## What's Next

Porygon-Z is currently a personal tool running in a single-user Slack workspace. The architecture supports more:

- **Multi-user access control**: Allow lists, maintainer roles, per-user permissions for shared workspaces
- **MCP tool ecosystem**: Integrate specialized tools for creative work, data processing, and automation
- **Scheduled automation**: Recurring tasks that run autonomously on your infrastructure
- **Cross-machine orchestration**: Coordinate work across multiple Porygon-Z instances

The vision is an AI agent fleet, managed through Slack, running on your own hardware, accessible from anywhere. Porygon-Z is the first step.

---

*I built this for myself. If you're someone who runs multiple machines, maintains side projects, and wants Claude Code in your pocket — you might want it too.*
