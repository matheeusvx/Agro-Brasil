import type {
  Workspace,
  Production,
  Order,
  Property,
  Crop,
  Home,
  Weather,
} from "./types";
export class RequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function request<T>(
  url: string,
  options: RequestInit = {},
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    cache: "no-store",
    signal,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const body = await response.json();
  if (!response.ok)
    throw new RequestError(
      response.status,
      body.error?.message ?? "Não foi possível concluir a consulta.",
    );
  return body;
}
export const agro = <T>(path: string, signal?: AbortSignal) =>
  request<T>("/api/agro" + path, {}, signal);
export async function allRows<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; offset < 10000; offset += 100) {
    const page = await agro<{ data: T[]; pagination?: { total: number } }>(
      path + (path.includes("?") ? "&" : "?") + "limit=100&offset=" + offset,
      signal,
    );
    result.push(...page.data);
    if (
      page.data.length < 100 ||
      result.length >= (page.pagination?.total ?? Infinity)
    )
      return result;
  }
  throw new Error(
    "A consulta ultrapassa o limite desta visão. Nenhum total parcial foi apresentado.",
  );
}
export async function loadWorkspace(
  propertyId: string | undefined,
  signal: AbortSignal,
): Promise<Workspace> {
  const catalog = await agro<{ properties: Property[]; crops: Crop[] }>(
    "/catalog",
    signal,
  );
  const property =
    catalog.properties.find((p) => p.id === propertyId) ??
    catalog.properties[0];
  if (!property)
    throw new Error(
      "Nenhuma propriedade cadastrada nesta organização. Solicite o cadastro ao responsável.",
    );
  const [home, weather, allProductions, orders] = await Promise.all([
    agro<Home>("/producer-home?propertyId=" + property.id, signal),
    agro<Weather>("/properties/" + property.id + "/weather", signal).catch(
      (error) => {
        if (
          error instanceof RequestError &&
          [401, 403, 404].includes(error.status)
        )
          throw error;
        return { status: "unavailable" };
      },
    ),
    allRows<Production>("/productions", signal),
    allRows<Order>("/orders", signal),
  ]);
  const productions = allProductions.filter(
    (p) => p.propertyId === property.id,
  );
  const lots = new Set(productions.map((p) => p.lot.id));
  return {
    catalog,
    property,
    home,
    weather,
    productions,
    orders: orders.filter((o) => lots.has(o.lotId)),
  };
}
