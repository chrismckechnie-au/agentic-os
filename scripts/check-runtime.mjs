const major = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);

if (!Number.isFinite(major) || major < 22) {
  console.error(
    `Agentic OS requires Node 22 or newer; current runtime is ${process.version}.`,
  );
  process.exit(1);
}
