#!/bin/bash

# This script compiles the circuit and generates the proving and verification keys.

echo "Compiling circuit..."
# Compile the circom file to get wasm and r1cs
circom circuit.circom --r1cs --wasm --sym -o .

echo "Generating proving key..."
# Generate the proving key (.zkey) using a powers of tau file.
# Download one if you don't have it: wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_12.ptau
snarkjs groth16 setup circuit.r1cs powersOfTau28_hez_final_12.ptau circuit_final.zkey -v

echo "Generating verification key..."
# Export the verification key
snarkjs zkey export verificationkey circuit_final.zkey verification_key.json

echo "ZK setup complete."