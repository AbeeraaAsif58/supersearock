import { createClient } from "@/lib/supabase/client";

type EdgeFunctionPayload =
  | string
  | Blob
  | ArrayBuffer
  | FormData
  | ReadableStream<Uint8Array>
  | Record<string, unknown>;

export async function invokeEdgeFunction<TData = unknown>(
  functionName: string,
  payload?: EdgeFunctionPayload,
) {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke<TData>(functionName, {
    body: payload,
  });

  if (error) {
    throw error;
  }

  return data;
}
