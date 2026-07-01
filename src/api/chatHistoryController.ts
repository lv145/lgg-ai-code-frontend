// @ts-ignore
/* eslint-disable */
import request from "@/utils/request";

/** 此处后端没有提供注释 POST /chatHistory/app/list/page */
export async function listAppChatHistoryByPage(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.listAppChatHistoryByPageParams,
  options?: { [key: string]: any }
) {
  return request<API.BaseResponsePageChatHistory>(
    "/chatHistory/app/list/page",
    {
      method: "POST",
      params: {
        // pageSize has a default value: 10
        pageSize: "10",
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 此处后端没有提供注释 POST /chatHistory/list/page */
export async function listChatHistoryByPage(
  body: API.ChatHistoryQueryRequest,
  options?: { [key: string]: any }
) {
  return request<API.BaseResponsePageChatHistory>("/chatHistory/list/page", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}
