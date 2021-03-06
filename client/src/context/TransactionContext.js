import React, { createContext, useEffect, useState } from 'react'
import { ethers } from 'ethers'
import { contractABI, contractAddress } from '../utils/Constants'

export const TransactionContext = createContext()

// for clients with metamask plugin enabled
// destructure metamask ethereum object from window
const { ethereum } = window

const getEthereumContract = () => {
  const provider = new ethers.providers.Web3Provider(ethereum)
  const signer = provider.getSigner()
  // instance of sc
  const transactionContract = new ethers.Contract(
    contractAddress,
    contractABI,
    signer
  )
  return transactionContract
}

export const TransactionProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [transactions, setTransactions] = useState([])
  const [transactionCount, setTransactionCount] = useState(
    localStorage.getItem('transactionCount')
  )
  const [currentAccount, setCurrentAccount] = useState('')
  const [formData, setFormData] = useState({
    addressTo: '',
    amount: '',
    keyword: '',
    message: '',
  })

  useEffect(() => {
    checkIfMetamaskEnabled()
    checkIfTransactionsExist()
  }, [])

  const changeHandler = (event, name) => {
    setFormData((prevState) => ({ ...prevState, [name]: event.target.value }))
  }

  const getAlltransactions = async () => {
    try {
      const transactionContract = getEthereumContract()
      const availableTransctions =
        await transactionContract.getAlltransactions()
      const structuredTransactions = availableTransctions.map(
        (transaction) => ({
          addressTo: transaction.receiver,
          addressFrom: transaction.sender,
          timestamp: new Date(
            transaction.timestamp.toNumber() * 1000
          ).toLocaleString(),
          message: transaction.message,
          keyword: transaction.keyword,
          amount: parseInt(transaction.amount._hex) / 10 ** 18, // convert from Gwei to ether
        })
      )
      setTransactions(structuredTransactions)
    } catch (error) {
      console.log(error)
    }
  }

  const checkIfMetamaskEnabled = async () => {
    // check if metamask signed in
    if (!ethereum)
      return alert('You must install the metamask plugin in order to proceed.')

    try {
      // request an object that specifies eth_accounts property
      const accounts = await ethereum.request({ method: 'eth_accounts' })

      if (accounts.length) {
        setCurrentAccount(accounts[0])
        getAlltransactions()
      } else {
        console.log('No metamask accounts found')
      }
    } catch (error) {
      console.log(error)
      throw new Error('No ethereum account in wallet object.')
    }
  }

  const checkIfTransactionsExist = async () => {
    try {
      const transactionContract = getEthereumContract()
      const transactionCount = await transactionContract.getTransactionCount()
      window.localStorage.setItem('transactionCount', transactionCount)
    } catch (error) {
      console.log(error)
      throw new Error('No ethereum objects.')
    }
  }

  // connect metamask wallet
  const connectWallet = async () => {
    // check for metamask plugin
    if (!ethereum)
      return alert('You must install the metamask plugin in order to proceed.')

    try {
      // request with method that returns array of all eth accounts
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' })

      if (accounts.length) {
        setCurrentAccount(accounts[0])
      } else {
        console.log('No wallet found')
      }
    } catch (error) {
      console.log(error)
      throw new Error('No ethereum account in wallet object.')
    }
  }

  // send && store transaction info to blockchain
  const sendTransaction = async () => {
    // check for metamask plugin
    if (!ethereum)
      return alert('You must install the metamask plugin in order to proceed.')

    const { addressTo, amount, keyword, message } = formData

    try {
      const transactionContract = getEthereumContract()
      const parsedAmount = ethers.utils.parseEther(amount)

      // TODO Create Slow, Medium, Fast gas option feature for Gwei
      // TODO mock eth-converter.com

      // Transaction #1 Send
      await ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: currentAccount,
            to: addressTo,
            gas: '0x5208', // 21000 Gwei
            value: parsedAmount._hex, // Ether
          },
        ],
      })

      // Transaction #2 Store update
      const transactionHash = await transactionContract.addToBlockchain(
        addressTo,
        parsedAmount,
        message,
        keyword
      )

      setIsLoading(true)

      // ethers resolve transaction blockchain receipt
      await transactionHash.wait()
      setIsLoading(false)

      const transactionCount = await transactionContract.getTransactionCount()

      setTransactionCount(transactionCount.toNumber())
      
      window.location.reload()

    } catch (error) {
      console.log(error)
      throw new Error('No ethereum account in wallet object.')
    }
  }

  // TODO add functionality for when metamask account becomes disconnected to detect and auto connect

  return (
    <TransactionContext.Provider
      value={{
        connectWallet,
        currentAccount,
        formData,
        sendTransaction,
        changeHandler,
        isLoading,
        transactions,
      }}
    >
      {children}
    </TransactionContext.Provider>
  )
}
