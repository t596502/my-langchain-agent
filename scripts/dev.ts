import { execSync } from 'child_process';

// 获取命令行参数（跳过 node 和脚本路径）
const args = process.argv.slice(2);

// 第一个参数作为文件名，默认为 'index'
const fileName = args[0] || 'index';

// 构建要执行的文件路径
const filePath = `src/${fileName}.ts`;

console.log(`Running: tsx ${filePath}`);

try {
  // 执行 tsx 命令，继承 stdio 以显示输出
  execSync(`tsx ${filePath}`, {
    stdio: 'inherit',
  });
} catch (error) {
  // 如果执行失败，退出码传递给父进程
  process.exit(1);
}