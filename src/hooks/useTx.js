import { useState } from "react";
import { useConfig, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

/** [CONTRACT WRITE] отправляет транзакцию, ждёт подтверждения; при ошибке кидает исключение и пишет error */
export function useTx() {
  const config = useConfig();
  const write = useWriteContract();
  const [state, setState] = useState({ pending: false, error: "" });

  const send = async (call) => {
    setState({ pending: true, error: "" });
    try {
      const hash = await write.mutateAsync(call);
      const receipt = await waitForTransactionReceipt(config, { hash });
      setState({ pending: false, error: "" });
      return receipt;
    } catch (e) {
      setState({ pending: false, error: e.shortMessage ?? e.message });
      throw e;
    }
  };
  return { ...state, send };
}