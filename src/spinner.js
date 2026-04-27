function withSpinner(message, run) {
  const frames = ["|", "/", "-", "\\"];
  let frameIndex = 0;

  process.stdout.write(`${message} ${frames[frameIndex]}`);
  const interval = setInterval(() => {
    frameIndex = (frameIndex + 1) % frames.length;
    process.stdout.write(`\r${message} ${frames[frameIndex]}`);
  }, 120);

  return Promise.resolve()
    .then(run)
    .finally(() => {
      clearInterval(interval);
      process.stdout.write(`\r${message} done\n`);
    });
}

module.exports = { withSpinner };
