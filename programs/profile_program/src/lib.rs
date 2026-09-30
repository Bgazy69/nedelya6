use anchor_lang::prelude::*;

declare_id!("EMF5hCT9w9SFRfjqqXSQSpJ4KkKTwgy6QrXiWeMztYnz");

const MAX_NAME_LEN: usize = 32;
const MAX_BIO_LEN: usize = 200;

#[program]
pub mod profile_program {
    use super::*;

    /// Создаёт on-chain профиль пользователя.
    /// Профиль хранится в PDA — адрес детерминированно выводится из seeds
    /// [b"profile", owner], поэтому у каждого владельца может быть ровно один профиль,
    /// и его адрес всегда можно вычислить заранее, не читая блокчейн.
    pub fn create_profile(ctx: Context<CreateProfile>, name: String, bio: String) -> Result<()> {
        require!(name.len() <= MAX_NAME_LEN, ProfileError::NameTooLong);
        require!(bio.len() <= MAX_BIO_LEN, ProfileError::BioTooLong);

        let profile = &mut ctx.accounts.profile;
        profile.owner = ctx.accounts.owner.key();
        profile.name = name;
        profile.bio = bio;
        profile.created_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Обновляет имя и био существующего профиля.
    /// Может вызвать только владелец (проверяется constraint `has_one = owner`).
    pub fn update_profile(ctx: Context<UpdateProfile>, name: String, bio: String) -> Result<()> {
        require!(name.len() <= MAX_NAME_LEN, ProfileError::NameTooLong);
        require!(bio.len() <= MAX_BIO_LEN, ProfileError::BioTooLong);

        let profile = &mut ctx.accounts.profile;
        profile.name = name;
        profile.bio = bio;
        Ok(())
    }
}

/// On-chain данные профиля.
#[account]
pub struct Profile {
    pub owner: Pubkey,
    pub name: String,
    pub bio: String,
    pub created_at: i64,
}

impl Profile {
    // 8 (дискриминатор Anchor) + 32 (Pubkey) + (4 + MAX_NAME_LEN) (String: длина + данные)
    // + (4 + MAX_BIO_LEN) + 8 (i64 timestamp)
    pub const MAX_SIZE: usize = 8 + 32 + (4 + MAX_NAME_LEN) + (4 + MAX_BIO_LEN) + 8;
}

#[derive(Accounts)]
pub struct CreateProfile<'info> {
    #[account(
        init,
        payer = owner,
        space = Profile::MAX_SIZE,
        seeds = [b"profile", owner.key().as_ref()],
        bump
    )]
    pub profile: Account<'info, Profile>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateProfile<'info> {
    #[account(
        mut,
        seeds = [b"profile", owner.key().as_ref()],
        bump,
        has_one = owner @ ProfileError::Unauthorized
    )]
    pub profile: Account<'info, Profile>,
    pub owner: Signer<'info>,
}

#[error_code]
pub enum ProfileError {
    #[msg("Имя слишком длинное (максимум 32 символа)")]
    NameTooLong,
    #[msg("Био слишком длинное (максимум 200 символов)")]
    BioTooLong,
    #[msg("Только владелец профиля может его изменить")]
    Unauthorized,
}