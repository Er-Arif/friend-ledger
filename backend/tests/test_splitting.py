from uuid import uuid4

import pytest

from app.domain.splitting import (
    SplitError,
    split_equal,
    validate_custom_split,
)


def test_equal_split_divides_evenly() -> None:
    arif = uuid4()
    sameer = uuid4()
    imran = uuid4()
    faizan = uuid4()

    shares = split_equal(
        total_amount_minor=240000,
        ordered_participant_user_ids=[
            arif,
            sameer,
            imran,
            faizan,
        ],
        payer_user_id=arif,
    )

    assert shares == {
        arif: 60000,
        sameer: 60000,
        imran: 60000,
        faizan: 60000,
    }

    assert sum(shares.values()) == 240000


def test_equal_split_distributes_remainder_exactly() -> None:
    arif = uuid4()
    sameer = uuid4()
    imran = uuid4()

    shares = split_equal(
        total_amount_minor=10000,
        ordered_participant_user_ids=[
            arif,
            sameer,
            imran,
        ],
        payer_user_id=arif,
    )

    assert shares[arif] == 3334
    assert shares[sameer] == 3333
    assert shares[imran] == 3333

    assert sum(shares.values()) == 10000


def test_equal_split_gives_remainder_to_payer_first() -> None:
    arif = uuid4()
    sameer = uuid4()
    imran = uuid4()

    shares = split_equal(
        total_amount_minor=10000,
        ordered_participant_user_ids=[
            sameer,
            arif,
            imran,
        ],
        payer_user_id=arif,
    )

    assert shares[arif] == 3334


def test_equal_split_works_when_payer_is_not_participant() -> None:
    arif = uuid4()
    sameer = uuid4()
    imran = uuid4()

    shares = split_equal(
        total_amount_minor=10000,
        ordered_participant_user_ids=[
            sameer,
            imran,
        ],
        payer_user_id=arif,
    )

    assert shares[sameer] == 5000
    assert shares[imran] == 5000


def test_equal_split_rejects_duplicate_participants() -> None:
    arif = uuid4()

    with pytest.raises(SplitError):
        split_equal(
            total_amount_minor=10000,
            ordered_participant_user_ids=[
                arif,
                arif,
            ],
            payer_user_id=arif,
        )


def test_equal_split_rejects_amount_too_small() -> None:
    arif = uuid4()
    sameer = uuid4()

    with pytest.raises(SplitError):
        split_equal(
            total_amount_minor=1,
            ordered_participant_user_ids=[
                arif,
                sameer,
            ],
            payer_user_id=arif,
        )


def test_custom_split_accepts_exact_total() -> None:
    arif = uuid4()
    sameer = uuid4()
    imran = uuid4()

    shares = validate_custom_split(
        total_amount_minor=10000,
        shares={
            arif: 2000,
            sameer: 5000,
            imran: 3000,
        },
        payer_user_id=arif,
    )

    assert sum(shares.values()) == 10000


def test_custom_split_allows_payer_to_be_excluded() -> None:
    arif = uuid4()
    sameer = uuid4()

    shares = validate_custom_split(
        total_amount_minor=50000,
        shares={
            sameer: 50000,
        },
        payer_user_id=arif,
    )

    assert shares == {
        sameer: 50000,
    }


def test_custom_split_rejects_wrong_total() -> None:
    arif = uuid4()
    sameer = uuid4()

    with pytest.raises(SplitError):
        validate_custom_split(
            total_amount_minor=50000,
            shares={
                arif: 10000,
                sameer: 20000,
            },
            payer_user_id=arif,
        )


def test_custom_split_rejects_personal_only_payment() -> None:
    arif = uuid4()

    with pytest.raises(SplitError):
        validate_custom_split(
            total_amount_minor=50000,
            shares={
                arif: 50000,
            },
            payer_user_id=arif,
        )
def test_equal_split_rejects_personal_only_payment() -> None:
    arif = uuid4()

    with pytest.raises(SplitError):
        split_equal(
            total_amount_minor=50000,
            ordered_participant_user_ids=[arif],
            payer_user_id=arif,
        )