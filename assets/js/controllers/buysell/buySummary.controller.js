angular
  .module('walletApp')
  .controller('BuySummaryCtrl', BuySummaryCtrl);

function BuySummaryCtrl ($scope, $q, $timeout, Wallet, buySell, currency, Alerts) {
  $scope.$parent.limits = {};
  $scope.exchange = buySell.getExchange();
  $scope.toggleEditAmount = () => $scope.$parent.editAmount = !$scope.$parent.editAmount;
  $scope.isBankTransfer = () => $scope.isMedium('bank');

  $scope.getMaxMin = (curr) => {
    const calculateMin = (rate) => {
      $scope.$parent.limits.min = (rate * 10).toFixed(2);
    };

    const calculateMax = (rate) => {
      $scope.$parent.limits.max = buySell.calculateMax(rate, $scope.method).max;
      $scope.$parent.limits.available = buySell.calculateMax(rate, $scope.method).available;
    };

    return buySell.fetchProfile(true).then(() => {
      let min = buySell.getRate('EUR', curr.code).then(calculateMin);
      let max = buySell.getRate($scope.exchange.profile.defaultCurrency, curr.code).then(calculateMax);
      return $q.all([min, max]).then($scope.setParentError);
    });
  };

  $scope.commitValues = () => {
    $scope.status.waiting = true;
    $scope.transaction.currency = $scope.tempCurrency;
    $scope.transaction.fiat = $scope.tempFiat;
    $scope.getQuote().then(() => $scope.status.waiting = false);
    $scope.$parent.changeCurrencySymbol($scope.transaction.currency);
    $scope.toggleEditAmount();
  };

  $scope.cancel = () => {
    $scope.tempCurrency = $scope.transaction.currency;
    $scope.tempFiat = $scope.transaction.fiat;
    $scope.$parent.fiatFormInvalid = false;
    $scope.toggleEditAmount();
  };

  $scope.changeTempCurrency = (curr) => (
    $scope.getMaxMin(curr).then(() => { $scope.tempCurrency = curr; })
  );

  $scope.setParentError = () => {
    $timeout(() => {
      $scope.$parent.fiatFormInvalid = $scope.tempFiatForm.$invalid && !$scope.needsKyc();
    });
  };

  let eventualError = (message) => Promise.reject.bind(Promise, { message });

  $scope.$parent.buy = () => {
    $scope.status.waiting = true;

    let success = (trade) => {
      $scope.$parent.trade = trade;
      Alerts.clear($scope.alerts);
      if ($scope.$parent.trade.bankAccount) $scope.formatTrade('bank_transfer');

      $scope.nextStep();
    };

    // check if bank transfer and kyc level
    if ($scope.needsKyc()) {
      return buySell.getOpenKYC().then(success, $scope.standardError);
    }

    let buyError = eventualError('ERROR_TRADE_CREATE');
    let amount = Math.round($scope.transaction.fiat * 100);

    $scope.exchange.buy(amount, $scope.transaction.currency.code, $scope.getMethod().inMedium)
                   .catch(buyError)
                   .then(success, $scope.standardError)
                   .then($scope.watchAddress);
  };

  $scope.$watch('transaction.currency', (newVal, oldVal) => {
    $scope.tempCurrency = $scope.transaction.currency;
  });

  $scope.$watch('transaction.fiat', (newVal, oldVal) => {
    $scope.tempFiat = $scope.transaction.fiat;
  });

  $scope.$watch('step', () => {
    $scope.onStep('summary') && $scope.getMaxMin($scope.tempCurrency);
  });
}