//  *Validate reward transaction*

export function validateRewardTransaction(transaction) {
    if (!transaction || typeof transaction !== "object") {
        throw new Error("Transaction must be an object");
    }

    if (!Number.isInteger(transaction.amount)) {
        throw new Error("Reward points must be a whole number");
    }

    if (transaction.amount === 0) {
        throw new Error("Reward points cannot be zero");
    }

    const allowedTypes = ["reward", "redemption", "correction"];

    if (!allowedTypes.includes(transaction.type)) {
        throw new Error(
            "Invalid transaction type. Allowed types: reward, redemption, correction"
        );
    }

    if (!transaction.customerId) {
        throw new Error("customerId is required");
    }

    if (!transaction.postedBy) {
        throw new Error("postedBy is required");
    }

    if (!transaction.reason) {
        throw new Error("reason is required");
    }

    return true;
}

//  *Balance Calculation*
export function calculateRewardBalance(transactions, customerId) {
    if (!Array.isArray(transactions)) {
        throw new Error("Transactions must be an array");
    }

    if (!customerId) {
        throw new Error("customerId is required");
    }

    return transactions
        .filter(transaction => transaction.customerId === customerId)
        .reduce((balance, transaction) => balance + transaction.amount, 0);
}

// *Transaction History*
export function getCustomerTransactions(transactions, customerId) {
    if (!Array.isArray(transactions)) {
        throw new Error("Transactions must be an array");
    }

    if (!customerId) {
        throw new Error("customerId is required");
    }

    return transactions.filter(
        transaction => transaction.customerId === customerId
    );
}

//    *Transaction Creation*
export function createRewardTransaction({
    id,
    customerId,
    amount,
    type,
    reason,
    reference = null,
    postedBy,
    postedAt = new Date().toISOString(),
    relatedTransactionId = null
}) {
    const transaction = {
        id,
        customerId,
        amount,
        type,
        reason,
        reference,
        postedBy,
        postedAt,
        relatedTransactionId
    };

    validateRewardTransaction(transaction);

    if (!type) {
        throw new Error("type is required");
    }

    return Object.freeze(transaction);
}

//    *Correction Reversal Function*

export function createCorrectionTransaction({
    id,
    originalTransaction,
    amount,
    reason,
    reference = null,
    postedBy,
    postedAt = new Date().toISOString()
}) {
    if (!originalTransaction) {
        throw new Error("Original transaction is required");
    }

    if (!originalTransaction.id) {
        throw new Error("Original transaction must have an id");
    }

    return createRewardTransaction({
        id,
        customerId: originalTransaction.customerId,
        amount,
        type: "correction",
        reason,
        reference,
        postedBy,
        postedAt,
        relatedTransactionId: originalTransaction.id
    });
}

