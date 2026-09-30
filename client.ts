import * as anchor from "@anchor-lang/core";
import { Program, AnchorProvider, Wallet } from "@anchor-lang/core";
import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// IDL, сгенерированный командой `anchor build`
const idl = JSON.parse(
  fs.readFileSync(path.join(__dirname, "target/idl/profile_program.json"), "utf-8")
);

const PROGRAM_ID = new PublicKey("EMF5hCT9w9SFRfjqqXSQSpJ4KkKTwgy6QrXiWeMztYnz");

async function main() {
  // 1. Подключаемся к Devnet
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  // 2. Загружаем тот же keypair, что используется в Solana CLI
  const secretKeyPath = path.join(os.homedir(), ".config", "solana", "id.json");
  const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(secretKeyPath, "utf-8")));
  const ownerKeypair = Keypair.fromSecretKey(secretKey);

  console.log("Владелец:", ownerKeypair.publicKey.toBase58());

  // 3. Провайдер и Program
  const wallet = new Wallet(ownerKeypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);
  const program = new Program(idl as any, provider);

  // 4. Вычисляем PDA профиля — детерминированный адрес из seeds [b"profile", owner]
  const [profilePda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("profile"), ownerKeypair.publicKey.toBuffer()],
    PROGRAM_ID
  );
  console.log("Profile PDA:", profilePda.toBase58(), "bump:", bump);

  // 5. Проверяем, существует ли уже профиль
  let existing = null;
  try {
    existing = await (program.account as any).profile.fetch(profilePda);
  } catch {
    existing = null;
  }

  if (!existing) {
    console.log("\n--- Вызываем create_profile ---");
    const tx = await program.methods
      .createProfile("Bigazy", "Solana course student, week 6: PDA profile")
      .accounts({
        profile: profilePda,
        owner: ownerKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    console.log("Транзакция create_profile:", tx);
  } else {
    console.log("\nПрофиль уже существует, создание пропускаем.");
  }

  // 6. Обновляем профиль
  console.log("\n--- Вызываем update_profile ---");
  const updateTx = await program.methods
    .updateProfile("Bigazy", "Updated bio: completed Week 6 PDA task!")
    .accounts({
      profile: profilePda,
      owner: ownerKeypair.publicKey,
    })
    .rpc();
  console.log("Транзакция update_profile:", updateTx);

  // 7. Читаем финальное состояние профиля напрямую с блокчейна
  const profileAccount = await (program.account as any).profile.fetch(profilePda);
  console.log("\n=== Финальный профиль ===");
  console.log("owner:", profileAccount.owner.toBase58());
  console.log("name:", profileAccount.name);
  console.log("bio:", profileAccount.bio);
  console.log("created_at:", new Date(profileAccount.createdAt.toNumber() * 1000).toISOString());
}

main().catch((err) => {
  console.error("Ошибка:", err);
  process.exit(1);
});
