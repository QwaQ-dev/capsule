import { useCallback, useState } from "react";
import { useConfig, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

const IDLE = { pending: false, error: "", hash: null, success: false };

export function useTx() {
  const config = useConfig();
  const write = useWriteContract();
  const [state, setState] = useState(IDLE);

  // final: true — the last transaction of the flow, shows the success message
  const send = async (call, { final = false } = {}) => {
    setState({ ...IDLE, pending: true });
    try {
      const hash = await write.mutateAsync(call);
      const receipt = await waitForTransactionReceipt(config, { hash });
      if (receipt.status === "reverted") throw new Error("Transaction reverted");
      setState({ ...IDLE, hash, success: final });
      return receipt;
    } catch (e) {
      setState({ ...IDLE, error: e.shortMessage ?? e.message });
      throw e;
    }
  };

  const reset = useCallback(() => setState(IDLE), []);

  return { ...state, send, reset };
}