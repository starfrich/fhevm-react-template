import { useEffect, useState } from "react";
import { useIsMounted } from "usehooks-ts";
import { usePublicClient } from "wagmi";
import { useSelectedNetwork } from "~~/hooks/helper";
import {
  Contract,
  ContractCodeStatus,
  ContractName,
  UseDeployedContractConfig,
  contracts,
} from "~~/utils/helper/contract";
import { validateAddress, logDebug, logError, handleError } from "~/lib/utils";

type DeployedContractData<TContractName extends ContractName> = {
  data: Contract<TContractName> | undefined;
  isLoading: boolean;
};

/**
 * Gets the matching contract info for the provided contract name from the contracts present in deployedContracts.ts
 * and externalContracts.ts corresponding to targetNetworks configured in scaffold.config.ts
 */
export function useDeployedContractInfo<TContractName extends ContractName>(
  config: UseDeployedContractConfig<TContractName>,
): DeployedContractData<TContractName>;
/**
 * @deprecated Use object parameter version instead: useDeployedContractInfo({ contractName: "YourContract" })
 */
export function useDeployedContractInfo<TContractName extends ContractName>(
  contractName: TContractName,
): DeployedContractData<TContractName>;

export function useDeployedContractInfo<TContractName extends ContractName>(
  configOrName: UseDeployedContractConfig<TContractName> | TContractName,
): DeployedContractData<TContractName> {
  const isMounted = useIsMounted();

  const finalConfig: UseDeployedContractConfig<TContractName> =
    typeof configOrName === "string" ? { contractName: configOrName } : (configOrName as any);

  useEffect(() => {
    if (typeof configOrName === "string") {
      console.warn(
        "Using `useDeployedContractInfo` with a string parameter is deprecated. Please use the object parameter version instead.",
      );
    }
  }, [configOrName]);
  const { contractName, chainId } = finalConfig;
  const selectedNetwork = useSelectedNetwork(chainId);
  const deployedContract = contracts?.[selectedNetwork.id]?.[contractName as ContractName] as Contract<TContractName>;
  const [status, setStatus] = useState<ContractCodeStatus>(ContractCodeStatus.LOADING);
  const publicClient = usePublicClient({ chainId: selectedNetwork.id });

  useEffect(() => {
    const checkContractDeployment = async () => {
      try {
        if (!isMounted() || !publicClient) return;

        if (!deployedContract) {
          logDebug(`Contract ${contractName} not found in configuration`);
          setStatus(ContractCodeStatus.NOT_FOUND);
          return;
        }

        // Validate contract address
        if (!validateAddress(deployedContract.address)) {
          logError(`Invalid contract address for ${contractName}`, deployedContract.address);
          setStatus(ContractCodeStatus.NOT_FOUND);
          return;
        }

        logDebug(`Checking deployment for ${contractName} at ${deployedContract.address}`);
        const code = await publicClient.getBytecode({
          address: deployedContract.address,
        });

        // If contract code is `0x` => no contract deployed on that address
        if (code === "0x") {
          logDebug(`No contract code found at ${deployedContract.address}`);
          setStatus(ContractCodeStatus.NOT_FOUND);
          return;
        }
        logDebug(`Contract ${contractName} is deployed`);
        setStatus(ContractCodeStatus.DEPLOYED);
      } catch (e) {
        const errorMsg = handleError(e);
        logError(`Error checking contract deployment for ${contractName}`, e);
        setStatus(ContractCodeStatus.NOT_FOUND);
      }
    };

    checkContractDeployment();
  }, [isMounted, contractName, deployedContract, publicClient]);

  return {
    data: status === ContractCodeStatus.DEPLOYED ? deployedContract : undefined,
    isLoading: status === ContractCodeStatus.LOADING,
  };
}
