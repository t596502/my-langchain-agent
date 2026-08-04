// src/index.ts

// 第一步：加载环境变量（必须在最顶部）
import "dotenv/config";

// 第二步：导入 LangChain 核心功能
import { createAgent, tool } from "langchain";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { AIMessage } from "langchain";

// 第三步：定义天气查询工具
const getWeather = tool(
  ({ city }) => `${city} 今日天气：晴，气温 22°C，湿度 60%`,
  {
    name: "get_weather",
    description: "查询指定城市的当前天气",
    schema: z.object({
      city: z.string().describe("要查询天气的城市名称"),
    }),
  }
);

// 第四步：创建 Agent

// openai只需传入模型的标识即可
// const agent = createAgent({
//   model: "openai:gpt-4o",
//   tools: [getWeather],
// });

//千问模型需要先创建一个模型实例
const model = new ChatOpenAI("qwen-max",{
  apiKey: process.env.QWEN_API_KEY, 
  configuration: {
    baseURL: process.env.QWEN_API_URL,
  }
});
//创建的模型作为model参数传给createAgent
const agent = createAgent({
  model,
  tools: [getWeather],
});


// 第五步：调用 Agent 并输出结果
/*
const result = await agent.invoke({
  messages: [{ role: "user", content: "北京和上海今天天气怎么样？" }],
});
console.log(result.messages.at(-1)?.content);
*/
// 使用 stream() 替代 invoke()
const stream = await agent.stream(
  { messages: [{ role: "user", content: "北京今天天气怎么样？" }] },
  { streamMode: "messages" }  // 流式返回每次状态更新
);

// 遍历流式数据
for await (const [message, metadata] of stream) {
   // 逐字符输出，实现打字机效果
    process.stdout.write(message.content);
}



