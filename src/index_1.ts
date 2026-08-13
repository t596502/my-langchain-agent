// src/index.ts

// 第一步：加载环境变量（必须在最顶部）
import "dotenv/config";

// 第二步：导入 LangChain 核心功能
import { createAgent, tool } from "langchain";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";

type GeocodingResponse = {
  results?: Array<{
    name: string;
    latitude: number;
    longitude: number;
    country?: string;
    admin1?: string;
  }>;
};

type WeatherResponse = {
  current?: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    weather_code: number;
    wind_speed_10m: number;
  };
  current_units?: {
    temperature_2m?: string;
    relative_humidity_2m?: string;
    apparent_temperature?: string;
    wind_speed_10m?: string;
  };
};

const weatherDescriptions: Record<number, string> = {
  0: "晴",
  1: "晴间多云",
  2: "局部多云",
  3: "阴",
  45: "雾",
  48: "雾凇",
  51: "小毛毛雨",
  53: "中等毛毛雨",
  55: "强毛毛雨",
  56: "小冻毛毛雨",
  57: "强冻毛毛雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  66: "小冻雨",
  67: "强冻雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  77: "米雪",
  80: "小阵雨",
  81: "中等阵雨",
  82: "强阵雨",
  85: "小阵雪",
  86: "大阵雪",
  95: "雷暴",
  96: "雷暴伴小冰雹",
  99: "雷暴伴大冰雹",
};

async function fetchJson<T>(url: URL): Promise<T> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`天气服务请求失败（HTTP ${response.status}）`);
  }

  return response.json() as Promise<T>;
}

// 第三步：定义天气查询工具
const getWeather = tool(
  async ({ city }) => {
    try {
      const geocodingUrl = new URL(
        "https://geocoding-api.open-meteo.com/v1/search"
      );
      geocodingUrl.search = new URLSearchParams({
        name: city,
        count: "1",
        language: "zh",
        format: "json",
      }).toString();

      const locations = await fetchJson<GeocodingResponse>(geocodingUrl);
      const location = locations.results?.[0];

      if (!location) {
        return `未找到城市“${city}”，请尝试输入更完整的城市名称。`;
      }

      const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
      weatherUrl.search = new URLSearchParams({
        latitude: String(location.latitude),
        longitude: String(location.longitude),
        current:
          "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
        timezone: "auto",
        forecast_days: "1",
      }).toString();

      const weather = await fetchJson<WeatherResponse>(weatherUrl);
      const current = weather.current;

      if (!current) {
        throw new Error("天气服务没有返回实时数据");
      }

      const locationName = [
        ...new Set(
          [location.name, location.admin1, location.country].filter(
            (part): part is string => Boolean(part)
          )
        ),
      ].join("，");
      const description =
        weatherDescriptions[current.weather_code] ??
        `未知天气（代码 ${current.weather_code}）`;
      const units = weather.current_units;

      return [
        `${locationName} 当前天气（${current.time}）`,
        `${description}，气温 ${current.temperature_2m}${units?.temperature_2m ?? "°C"}`,
        `体感 ${current.apparent_temperature}${units?.apparent_temperature ?? "°C"}`,
        `湿度 ${current.relative_humidity_2m}${units?.relative_humidity_2m ?? "%"}`,
        `风速 ${current.wind_speed_10m}${units?.wind_speed_10m ?? "km/h"}`,
        "数据来源：Open-Meteo (https://open-meteo.com/)",
      ].join("；");
    } catch (error) {
      const reason = error instanceof Error ? error.message : "未知错误";
      return `查询“${city}”天气失败：${reason}。请稍后重试。`;
    }
  },
  {
    name: "get_weather",
    description: "通过 Open-Meteo 查询指定城市的实时天气",
    schema: z.object({
      city: z.string().trim().min(2).describe("要查询天气的城市名称"),
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
for await (const [message] of stream) {
   // 逐字符输出，实现打字机效果
    const content =
      typeof message.content === "string"
        ? message.content
        : JSON.stringify(message.content);
    process.stdout.write(content);
}
