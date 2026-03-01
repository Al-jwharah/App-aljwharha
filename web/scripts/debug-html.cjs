const { spawn } = require('child_process');

const server = spawn('npm', ['run', 'start', '--', '--hostname', '127.0.0.1', '--port', '3000'], {
  cwd: process.cwd(),
  shell: true,
  stdio: 'ignore',
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch('http://127.0.0.1:3000');
      if (res.ok) {
        const html = await res.text();
        console.log('hasListingsId', html.includes('id="listings"'));
        console.log('hasArabicAdd', html.includes('إضافة للسلة'));
        console.log('hasEnglishAdd', html.includes('Add to cart'));
        break;
      }
    } catch {
      // retry
    }
    await wait(1000);
  }

  server.kill('SIGTERM');
  setTimeout(() => server.kill('SIGKILL'), 300);
})();
