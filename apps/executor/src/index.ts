const args = process.argv.slice(2);
const command = args[0];

if (command === "login") {
    console.log("准备开始登录");
} else if (command === undefined || command === "--help") {
    console.log("用法：rabi login");
} else {
    console.error(`未知命令：${command}`);
    process.exitCode = 1;
}
