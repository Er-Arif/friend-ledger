from uuid import UUID


class SplitError(ValueError):
    pass


def split_equal(
    *,
    total_amount_minor: int,
    ordered_participant_user_ids: list[UUID],
    payer_user_id: UUID,
) -> dict[UUID, int]:
    if total_amount_minor <= 0:
        raise SplitError("Payment amount must be greater than zero.")

    if not ordered_participant_user_ids:
        raise SplitError("At least one participant is required.")

    if len(set(ordered_participant_user_ids)) != len(
        ordered_participant_user_ids
    ):
        raise SplitError("Participants must be unique.")

    participant_count = len(ordered_participant_user_ids)

    if total_amount_minor < participant_count:
        raise SplitError(
            "Payment amount is too small to give every participant "
            "at least one minor unit."
        )

    ordered_ids = list(ordered_participant_user_ids)

    if payer_user_id in ordered_ids:
        ordered_ids.remove(payer_user_id)
        ordered_ids.insert(0, payer_user_id)

    base_share, remainder = divmod(
        total_amount_minor,
        participant_count,
    )

    shares = {
        user_id: base_share
        for user_id in ordered_ids
    }

    for user_id in ordered_ids[:remainder]:
        shares[user_id] += 1

    return shares


def validate_custom_split(
    *,
    total_amount_minor: int,
    shares: dict[UUID, int],
    payer_user_id: UUID,
) -> dict[UUID, int]:
    if total_amount_minor <= 0:
        raise SplitError("Payment amount must be greater than zero.")

    if not shares:
        raise SplitError("At least one participant is required.")

    if any(amount <= 0 for amount in shares.values()):
        raise SplitError(
            "Every participant share must be greater than zero."
        )

    if sum(shares.values()) != total_amount_minor:
        raise SplitError(
            "Participant shares must equal the payment total."
        )

    positive_non_payer_share_exists = any(
        user_id != payer_user_id and amount > 0
        for user_id, amount in shares.items()
    )

    if not positive_non_payer_share_exists:
        raise SplitError(
            "At least one other person must participate in the payment."
        )

    return dict(shares)