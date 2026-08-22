declare namespace API {
  type App = {
    id?: string;
    appName?: string;
    cover?: string;
    initPrompt?: string;
    codeGenType?: string;
    isBuilderComplete?: boolean;
    deployKey?: string;
    deployedTime?: string;
    priority?: number;
    userId?: string;
    editTime?: string;
    createTime?: string;
    updateTime?: string;
    isAgentModel?: boolean;
    isDelete?: number;
  };

  type AppAddRequest = {
    initPrompt?: string;
    isAgentModel?: boolean;
  };

  type AppAdminUpdateRequest = {
    id?: string;
    appName?: string;
    cover?: string;
    priority?: number;
  };

  type AppDeployRequest = {
    appId?: string;
  };

  type AppQueryRequest = {
    pageNum?: number;
    pageSize?: number;
    sortField?: string;
    sortOrder?: string;
    id?: string;
    appName?: string;
    cover?: string;
    initPrompt?: string;
    codeGenType?: string;
    deployKey?: string;
    priority?: number;
    userId?: string;
  };

  type AppUserQueryRequest = {
    pageNum?: number;
    pageSize?: number;
    sortField?: string;
    sortOrder?: string;
    appName?: string;
  };

  type AppUserUpdateRequest = {
    id?: string;
    appName?: string;
  };

  type AppVO = {
    id?: string;
    appName?: string;
    cover?: string;
    initPrompt?: string;
    codeGenType?: string;
    isBuilderComplete?: boolean;
    deployKey?: string;
    deployedTime?: string;
    priority?: number;
    userId?: string;
    createTime?: string;
    updateTime?: string;
  };

  type BaseResponseApp = {
    code?: number;
    data?: App;
    message?: string;
  };

  type BaseResponseAppVO = {
    code?: number;
    data?: AppVO;
    message?: string;
  };

  type BaseResponseBoolean = {
    code?: number;
    data?: boolean;
    message?: string;
  };

  type BaseResponseLoginUserVO = {
    code?: number;
    data?: LoginUserVO;
    message?: string;
  };

  type BaseResponseLong = {
    code?: number;
    data?: string;
    message?: string;
  };

  type BaseResponsePageAppVO = {
    code?: number;
    data?: PageAppVO;
    message?: string;
  };

  type BaseResponsePageChatHistory = {
    code?: number;
    data?: PageChatHistory;
    message?: string;
  };

  type BaseResponsePageUserVO = {
    code?: number;
    data?: PageUserVO;
    message?: string;
  };

  type BaseResponseString = {
    code?: number;
    data?: string;
    message?: string;
  };

  type BaseResponseUser = {
    code?: number;
    data?: User;
    message?: string;
  };

  type BaseResponseUserVO = {
    code?: number;
    data?: UserVO;
    message?: string;
  };

  type ChatHistory = {
    id?: string;
    message?: string;
    messageType?: string;
    appId?: string;
    userId?: string;
    createTime?: string;
    updateTime?: string;
    isDelete?: number;
    parentId?: string;
  };

  type ChatHistoryOriginal = {
    id?: string;
    message?: string;
    messageType?: string;
    appId?: string;
    userId?: string;
    createTime?: string;
    updateTime?: string;
    isDelete?: number;
  };

  type ChatHistoryQueryRequest = {
    pageNum?: number;
    pageSize?: number;
    sortField?: string;
    sortOrder?: string;
    id?: string;
    appId?: string;
    userId?: string;
    messageType?: string;
    message?: string;
    lastCreateTime?: string;
  };

  type chatToGenCodeParams = {
    appId: string;
    message: string;
    requestId: string;
  };

  type DeleteRequest = {
    id?: string;
  };

  type downloadParams = {
    appId: string;
  };

  type getAppByIdParams = {
    id: string;
  };

  type getAppVOByIdParams = {
    id: string;
  };

  type getInfoParams = {
    id: string;
  };

  type getUserByIdParams = {
    id: string;
  };

  type getUserVOByIdParams = {
    id: string;
  };

  type listAppChatHistoryByPageParams = {
    appId: string;
    lastCreateTime?: string;
    pageSize?: number;
  };

  type LoginUserVO = {
    id?: string;
    userAccount?: string;
    userName?: string;
    userAvatar?: string;
    userProfile?: string;
    userRole?: string;
    createTime?: string;
    updateTime?: string;
  };

  type PageAppVO = {
    records?: AppVO[];
    pageNumber?: number;
    pageSize?: number;
    totalPage?: number;
    totalRow?: number;
    optimizeCountQuery?: boolean;
  };

  type PageChatHistory = {
    records?: ChatHistory[];
    pageNumber?: number;
    pageSize?: number;
    totalPage?: number;
    totalRow?: number;
    optimizeCountQuery?: boolean;
  };

  type PageChatHistoryOriginal = {
    records?: ChatHistoryOriginal[];
    pageNumber?: number;
    pageSize?: number;
    totalPage?: number;
    totalRow?: number;
    optimizeCountQuery?: boolean;
  };

  type pageParams = {
    page: PageChatHistoryOriginal;
  };

  type PageUserVO = {
    records?: UserVO[];
    pageNumber?: number;
    pageSize?: number;
    totalPage?: number;
    totalRow?: number;
    optimizeCountQuery?: boolean;
  };

  type removeParams = {
    id: string;
  };

  type ServerSentEventString = true;

  type startGenerationTaskParams = {
    appId: string;
    message: string;
  };

  type StreamStopRequest = {
    appId?: string;
    requestId?: string;
  };

  type serveStaticResourceParams = {
    deployKey: string;
  };

  type User = {
    id?: string;
    userAccount?: string;
    userPassword?: string;
    userName?: string;
    userAvatar?: string;
    userProfile?: string;
    userRole?: string;
    editTime?: string;
    createTime?: string;
    updateTime?: string;
    isDelete?: number;
    vipExpireTime?: string;
    vipCode?: string;
    vipNumber?: number;
    shareCode?: string;
    inviteUser?: string;
  };

  type UserAddRequest = {
    userName?: string;
    userAccount?: string;
    userAvatar?: string;
    userProfile?: string;
    userRole?: string;
  };

  type UserLoginRequest = {
    userAccount?: string;
    userPassword?: string;
  };

  type UserQueryRequest = {
    pageNum?: number;
    pageSize?: number;
    sortField?: string;
    sortOrder?: string;
    id?: string;
    userName?: string;
    userAccount?: string;
    userProfile?: string;
    userRole?: string;
  };

  type UserRegisterRequest = {
    userAccount?: string;
    userName?: string;
    userPassword?: string;
    checkPassword?: string;
  };

  type UserUpdateRequest = {
    id?: string;
    userName?: string;
    userAvatar?: string;
    userProfile?: string;
    userRole?: string;
  };

  type UserVO = {
    id?: string;
    userAccount?: string;
    userName?: string;
    userAvatar?: string;
    userProfile?: string;
    userRole?: string;
    createTime?: string;
  };
}
